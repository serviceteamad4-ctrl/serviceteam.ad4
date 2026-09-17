import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import Dashboard from './Dashboard.jsx';
import RequestDetail from './RequestDetail.jsx';
import FilterPanel from './FilterPanel.jsx';
import EditableDropdown from './EditableDropdown.jsx';
import { getStoredDropdownData, addDropdownValue, removeDropdownValue } from './excelDataManager.js';
import { dateFields as filterDateFields, filterFieldLabels } from './FilterPanel.jsx';
import { isViewableImageUrl } from './requestUtils.js';
import mascotLogo from './assets/mascot-dog.jpg';

// ตัด "/" ท้ายออก กัน URL ซ้อนกัน (เช่น "https://api.example.com/" + "/api/requests" จะกลายเป็น "...com//api/requests" ซึ่ง 404)
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

// ไอคอนเมนูซ้าย: ใช้ SVG เส้น (stroke) แทนตัวอักษร Unicode (▦ ◒) เพื่อให้ขนาด/น้ำหนักเส้นสม่ำเสมอกันทุกอัน
function IconRequests() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="12" height="14" rx="2" />
      <path d="M7.5 3V2.6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V3" />
      <path d="M7 9.5h6M7 12.5h6M7 15.5h3" />
    </svg>
  );
}

function IconReports() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 16.5V9" />
      <path d="M9.5 16.5V3" />
      <path d="M15.5 16.5v-6" />
      <path d="M3 16.5h14" />
    </svg>
  );
}

// ลำดับสถานะที่ต้องแสดง "รับเรื่อง" มาก่อนเสมอ ใช้ทั้งจัดเรียงก่อนแบ่งหน้าและจัดกลุ่มในตาราง
// เพื่อไม่ให้การแบ่งหน้าตัดกลุ่มสถานะเดียวกันขาดออกจากกันแบบสุ่มตามวันที่
const STATUS_ORDER = ['รับเรื่อง', 'รอดำเนินการ', 'กำลังดำเนินการ', 'รอลูกค้าสรุปงาน', 'รอส่งสื่อตามวันที่ลูกค้ากำหนด', 'รออะไหล่', 'รอเสนอราคา', 'รอจัดคิวช่าง', 'เรียบร้อยปกติ', 'ยกเลิก'];
const statusRank = (status) => {
  const index = STATUS_ORDER.indexOf(status);
  return index === -1 ? STATUS_ORDER.length : index;
};

const emptyRequest = {
  ref: '',
  customer: '',
  source: 'ไลน์',
  receivedAt: '',
  ticket: '',
  location: '',
  site: '',
  contact: '',
  phone: '',
  description: '',
  image: '',
  ma: '',
  jobType: 'แนะนำ',
  status: 'รับเรื่อง',
  assignee: '',
  appointment: '',
  appointmentEnd: '',
  action: '',
  result: '',
  equipment: '',
  completedAt: '',
  map: '',
  vehicle: '',
  notes: '',
  file: '',
};

const formatDate = (value) => value ? new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value)) : '-';

// input type="datetime-local" ต้องการ "YYYY-MM-DDTHH:mm" แบบเวลาท้องถิ่น ไม่ใช่ UTC
// toISOString() คืนเวลา UTC เสมอ ถ้าใช้ตรงๆ เวลาที่ขึ้นในฟอร์มจะเพี้ยนไปตาม timezone offset (เช่น ไทย +7 ชม.)
const toDateTimeLocalValue = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const monthKeyFromValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const year = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(date);
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', month: '2-digit' }).format(date);
  return `${year}-${month}`;
};

// "เสนอราคา" กับ "รอเสนอราคา" คือสถานะเดียวกัน รวมให้เหลือชื่อเดียวเพื่อไม่ให้งานกระจายเป็นสองกลุ่ม
const STATUS_ALIASES = { 'เสนอราคา': 'รอเสนอราคา' };

const normalizeRequest = (item = {}) => {
  const nextItem = { ...emptyRequest, ...item };
  delete nextItem.priority;
  if (STATUS_ALIASES[nextItem.status]) {
    nextItem.status = STATUS_ALIASES[nextItem.status];
  }
  return nextItem;
};

const readRequests = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/requests`);
    if (!response.ok) {
      throw new Error('Failed to fetch requests');
    }
    const data = await response.json();
    return Array.isArray(data) ? data.map(normalizeRequest) : [];
  } catch {
    return [];
  }
};

const buildTrackingPrefix = (customer = '') => {
  const cleaned = String(customer || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
  return cleaned || 'REQ';
};

// เลขวิ่งท้ายรันต่อเนื่องกันทั้งระบบ (ไม่ใช่แยกนับใหม่ต่อลูกค้าแต่ละราย) ให้ตรงกับข้อมูลเก่าที่มีอยู่จริง
// เช่น RIC000010 -> VES000011 -> WOR000012 แม้เปลี่ยนลูกค้าตัวเลขก็ยังนับต่อ ไม่ย้อนกลับไป 000001
// ไม่นับเลขที่ไม่มีตัวอักษรนำหน้า (เช่น "100004725") เพราะเป็นข้อมูลเพี้ยนที่หลุดเข้ามาก่อนหน้านี้ ไม่ใช่เลขรันจริง
const generateTrackingNumber = (customer, existingRequests = []) => {
  const prefix = buildTrackingPrefix(customer);
  const numbers = existingRequests
    .map((item) => item.ticket)
    .filter((value) => typeof value === 'string')
    .map((value) => value.match(/^\D+(\d{1,6})$/))
    .filter(Boolean)
    .map((match) => Number.parseInt(match[1], 10));

  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `${prefix}${String(next).padStart(6, '0')}`;
};

const pdfDetailFields = [
  ['customer', 'ลูกค้า'], ['ref', 'Ref.'], ['source', 'แหล่งที่มา'],
  ['receivedAt', 'วันเวลาที่รับแจ้ง'], ['ticket', 'เลขที่ติดตามงาน'], ['location', 'สถานที่/สาขา'],
  ['site', 'สถานที่ตั้ง'], ['contact', 'ผู้ติดต่อ'], ['phone', 'เบอร์ติดต่อ'], ['description', 'ข้อมูลการรับแจ้ง'],
  ['image', 'รูปภาพที่แจ้ง'], ['ma', 'MA'], ['jobType', 'ลักษณะงาน'], ['status', 'สถานะงาน'],
  ['assignee', 'ผู้ดำเนินการ'], ['appointment', 'วันนัดหมาย เวลาเริ่มต้น'], ['appointmentEnd', 'วันนัดหมาย เวลาสิ้นสุด'],
  ['action', 'รายละเอียดการดำเนินการ'], ['result', 'ผลการดำเนินการ'], ['equipment', 'เกี่ยวกับอุปกรณ์'],
  ['completedImage', 'รูปภาพที่ดำเนินการเสร็จแล้ว'], ['completedAt', 'วันเวลาเสร็จ'], ['map', 'MAP'],
  ['vehicle', 'ทะเบียนรถ'], ['notes', 'หมายเหตุ'], ['file', 'ไฟล์'],
];

const pdfValue = (key, value) => ['receivedAt', 'appointment', 'appointmentEnd', 'completedAt'].includes(key)
  ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value))
  : String(value);

const printPdf = async (title, exportItems = []) => {
  if (!exportItems.length) {
    await Swal.fire({
      icon: 'info',
      title: 'ไม่มีข้อมูลสำหรับส่งออก',
      text: 'ไม่พบรายการตามเงื่อนไขที่เลือก',
      confirmButtonText: 'ปิด',
      confirmButtonColor: '#5b5ce2',
    });
    return;
  }

  try {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = 210;
    const pageHeight = 297;

    for (let itemIndex = 0; itemIndex < exportItems.length; itemIndex++) {
      const item = exportItems[itemIndex];
      if (itemIndex > 0) pdf.addPage();
      const canvas = document.createElement('canvas');
      canvas.width = 1240;
      canvas.height = 1754;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('ไม่สามารถสร้างพื้นที่วาด PDF ได้');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#f6f7ff';
      context.roundRect(55, 45, 1130, 120, 24);
      context.fill();
      context.fillStyle = '#172033';
      context.font = '700 34px Arial, sans-serif';
      context.fillText(title, 82, 92);
      context.fillStyle = '#667085';
      context.font = '18px Arial, sans-serif';
      context.fillText(`รายการ ${itemIndex + 1} / ${exportItems.length}`, 82, 133);
      context.strokeStyle = '#dfe3ee';
      context.lineWidth = 2;
      context.roundRect(55, 195, 1130, 1500, 24);
      context.stroke();
      context.fillStyle = '#172033';
      context.font = '700 25px Arial, sans-serif';
      context.fillText(`${item.status || '-'}   ${item.ref || ''}`, 88, 252);
      let y = 305;
      const drawWrapped = (text, x, maxWidth) => {
        const words = String(text || '-').split('');
        let line = '';
        const lines = [];
        words.forEach((char) => {
          const next = line + char;
          if (context.measureText(next).width > maxWidth && line) {
            lines.push(line);
            line = char;
          } else line = next;
        });
        if (line) lines.push(line);
        lines.forEach((lineText) => {
          context.fillText(lineText, x, y);
          y += 27;
        });
      };

      // Draw fields with special handling for images
      pdfDetailFields.forEach(([key, label]) => {
        if (!item[key]) return;
        if (['image', 'completedImage'].includes(key)) return; // Skip images for now, handle separately
        context.fillStyle = '#778196';
        context.font = '17px Arial, sans-serif';
        context.fillText(label, 88, y);
        y += 25;
        context.fillStyle = '#172033';
        context.font = '20px Arial, sans-serif';
        drawWrapped(pdfValue(key, item[key]), 88, 1060);
        y += 14;
      });

      // Load and add images if they exist
      const loadImage = (src) => new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.crossOrigin = 'anonymous';
      });

      if (item.image || item.completedImage) {
        y += 20;
        if (item.image) {
          context.fillStyle = '#778196';
          context.font = '17px Arial, sans-serif';
          context.fillText('รูปภาพที่แจ้ง', 88, y);
          y += 25;
          try {
            const img = await loadImage(item.image);
            if (img) {
              const imgWidth = 300;
              const imgHeight = (img.height / img.width) * imgWidth;
              context.drawImage(img, 88, y, imgWidth, imgHeight);
              y += imgHeight + 20;
            }
          } catch (e) {
            console.error('Error loading image:', e);
          }
        }
        if (item.completedImage) {
          context.fillStyle = '#778196';
          context.font = '17px Arial, sans-serif';
          context.fillText('รูปภาพที่ดำเนินการเสร็จแล้ว', 88, y);
          y += 25;
          try {
            const img = await loadImage(item.completedImage);
            if (img) {
              const imgWidth = 300;
              const imgHeight = (img.height / img.width) * imgWidth;
              context.drawImage(img, 88, y, imgWidth, imgHeight);
              y += imgHeight + 20;
            }
          } catch (e) {
            console.error('Error loading image:', e);
          }
        }
      }

      pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, pageWidth, pageHeight);
    }
    pdf.save(`${title.replace(/[\\/:*?"<>|]/g, '-').trim()}.pdf`);
  } catch (error) {
    await Swal.fire({
      icon: 'error',
      title: 'ส่งออก PDF ไม่สำเร็จ',
      text: error instanceof Error ? error.message : 'ไม่สามารถสร้างไฟล์ PDF ได้',
      confirmButtonText: 'ปิด',
      confirmButtonColor: '#5b5ce2',
    });
  }
};

function App() {
  const [requests, setRequests] = useState([]);
  const [view, setView] = useState('requests');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState('ทั้งหมด');
  const [selectedMonth, setSelectedMonth] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit' }).format(new Date()));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filterOpen, setFilterOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({});
  const [editing, setEditing] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  // จำตำแหน่งเลื่อนหน้าจอ + งานที่พึ่งเปิดดู ไว้ตอนกดแก้ไข/ดูรายละเอียด
  // เพื่อให้กด "ย้อนกลับ" แล้วกลับมาที่เดิมโดยไม่ต้องเลื่อนหาใหม่
  const listScrollRef = useRef(0);
  const [lastVisitedId, setLastVisitedId] = useState(null);
  const leaveList = (id) => {
    listScrollRef.current = window.scrollY;
    setLastVisitedId(id || null);
  };
  const [toast, setToast] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadRequests = async () => {
      setIsLoading(true);
      setError('');
      try {
        const nextRequests = await readRequests();
        setRequests(nextRequests);
      } catch {
        setError('ไม่สามารถโหลดข้อมูลได้');
      } finally {
        setIsLoading(false);
      }
    };
    loadRequests();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const advancedEntries = Object.entries(advancedFilters).filter(([key, value]) => {
      if (filterDateFields.includes(key)) return value && (value.from || value.to);
      return Array.isArray(value) ? value.length : value;
    });
    return requests
      .filter((item) => {
        if (q) {
          const haystack = [
            item.customer,
            item.ticket,
            item.location,
            item.description,
            item.status,
            item.assignee,
            item.ref,
          ].join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (status !== 'ทั้งหมด' && item.status !== status) return false;
        if (selectedMonth && item.receivedAt && monthKeyFromValue(item.receivedAt) !== selectedMonth) return false;
        for (const [key, value] of advancedEntries) {
          if (filterDateFields.includes(key)) {
            const itemDate = item[key] ? String(item[key]).slice(0, 10) : '';
            if (value.from && (!itemDate || itemDate < value.from)) return false;
            if (value.to && (!itemDate || itemDate > value.to)) return false;
            continue;
          }
          const selectedValues = Array.isArray(value) ? value : [value];
          if (!selectedValues.includes(String(item[key] || ''))) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const rankDiff = statusRank(a.status) - statusRank(b.status);
        if (rankDiff !== 0) return rankDiff;
        return (b.receivedAt ? Date.parse(b.receivedAt) : 0) - (a.receivedAt ? Date.parse(a.receivedAt) : 0);
      });
  }, [requests, debouncedQuery, status, advancedFilters, selectedMonth]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, status, selectedMonth, advancedFilters]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedFiltered = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const persist = async (requestItem) => {
    const normalized = normalizeRequest(requestItem);
    const isUpdate = Boolean(normalized.id);
    const endpoint = isUpdate ? `${API_BASE_URL}/api/requests/${normalized.id}` : `${API_BASE_URL}/api/requests`;
    const method = isUpdate ? 'PUT' : 'POST';

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalized),
      });

      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.message || 'API save failed');
      }

      const saved = normalizeRequest(await response.json());
      const updated = isUpdate
        ? requests.map((item) => item.id === saved.id ? saved : item)
        : [...requests, saved];

      setRequests(updated);
      return updated;
    } catch (error) {
      throw error;
    }
  };

  const saveRequest = async (request) => {
    const normalized = normalizeRequest({ ...request });
    const isExisting = Boolean(normalized.id);

    if (!isExisting) {
      normalized.receivedAt = new Date().toISOString();
    }

    const nextTicket = normalized.ticket && normalized.ticket.trim() ? normalized.ticket.trim() : generateTrackingNumber(normalized.customer, requests);
    normalized.ticket = nextTicket;

    try {
      const saved = await persist(normalized);
      setRequests(saved);
      setEditing(null);
      await Swal.fire({
        icon: 'success',
        title: isExisting ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มงานใหม่แล้ว',
        text: `เลขติดตาม ${normalized.ticket}`,
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#ef765e',
        timer: 2200,
        timerProgressBar: true,
      });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'บันทึกไม่สำเร็จ',
        text: error instanceof Error ? error.message : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้',
        confirmButtonText: 'ปิด',
        confirmButtonColor: '#ef765e',
      });
    }
  };

  const handleDeleteRequest = async (requestId) => {
    if (!requestId) return;
    const confirmation = await Swal.fire({
      icon: 'warning',
      title: 'ยืนยันการลบงาน',
      text: 'ข้อมูลนี้จะถูกลบออกจากระบบและไม่สามารถกู้คืนได้',
      showCancelButton: true,
      confirmButtonText: 'ลบงาน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc5b56',
      cancelButtonColor: '#8b9aa1',
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/requests/${requestId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('Delete failed');
      }

      const next = requests.filter((item) => item.id !== requestId);
      setRequests(next);
      setSelectedRequest(null);
      setEditing(null);
      await Swal.fire({
        icon: 'success',
        title: 'ลบงานแล้ว',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#ef765e',
        timer: 1800,
        timerProgressBar: true,
      });
    } catch {
      setError('ลบงานไม่สำเร็จ');
      await Swal.fire({
        icon: 'error',
        title: 'ลบงานไม่สำเร็จ',
        text: 'กรุณาตรวจสอบการเชื่อมต่อเซิร์ฟเวอร์แล้วลองใหม่',
        confirmButtonText: 'ปิด',
        confirmButtonColor: '#ef765e',
      });
    }
  };

  const exportCsv = () => {
    const headers = ['ลูกค้า', 'Ref.', 'ช่องทาง', 'วันเวลารับแจ้ง', 'เลขติดตาม', 'สถานที่', 'ผู้ติดต่อ', 'รายละเอียด', 'ลักษณะงาน', 'สถานะ', 'ผู้ดำเนินการ', 'วันเวลานัดหมาย', 'วันเวลาเสร็จ', 'การดำเนินการ', 'หมายเหตุ'];
    const keys = ['customer', 'ref', 'source', 'receivedAt', 'ticket', 'location', 'contact', 'description', 'jobType', 'status', 'assignee', 'appointment', 'completedAt', 'action', 'notes'];
    const csv = '\ufeff' + [headers, ...requests.map((row) => keys.map((key) => row[key] || ''))]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `service-desk-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <div className="brand">
          <img className="brand-mark" src={mascotLogo} alt="Service Desk" />
          <div className="brand-text">
            <strong>Service Desk </strong>
            <small></small>
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
            title={sidebarCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
          >
            ‹
          </button>
        </div>
        <nav className="side-nav">
          <button className={`nav-item ${view === 'requests' ? 'active' : ''}`} onClick={() => setView('requests')} title="งานแจ้งบริการ">
            <span className="nav-icon"><IconRequests /></span> <span className="nav-label">งานแจ้งบริการ</span>
          </button>
          <button className={`nav-item ${view === 'reports' ? 'active' : ''}`} onClick={() => setView('reports')} title="รายงานและสถิติ ประจำวัน">
            <span className="nav-icon"><IconReports /></span> <span className="nav-label">รายงานและสถิติ ประจำวัน</span>
          </button>
        </nav>
        <div className="side-foot">
          <div className="status-dot" />
          <div className="side-foot-text">
            <strong></strong>
            <small></small>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <img className="brand-mark" src={mascotLogo} alt="Service Desk" />
            <strong>Service Desk</strong>
          </div>
          <div className="top-actions">
            <span>{requests.length} รายการ</span>
            <button className="avatar">A</button>
          </div>
        </header>

        {view === 'requests' ? (
          editing ? (
            <RequestEditor
              request={editing}
              requests={requests}
              onClose={() => setEditing(null)}
              onSave={saveRequest}
              onDelete={async () => {
                await handleDeleteRequest(editing.id);
                setEditing(null);
              }}
            />
          ) : (
            <div className={`requests-split${selectedRequest ? ' has-detail' : ''}`}>
              <div className="requests-split-list">
                <RequestsView
                  compact={Boolean(selectedRequest)}
                  selectedId={selectedRequest?.id}
                  onView={(request) => setSelectedRequest(request)}
                  scrollRestoreRef={listScrollRef}
                  highlightId={lastVisitedId}
                  onHighlightExpire={() => setLastVisitedId(null)}
                  requests={requests}
                  filtered={filtered}
                  pageItems={paginatedFiltered}
                  query={query}
                  setQuery={setQuery}
                  status={status}
                  setStatus={setStatus}
                  selectedMonth={selectedMonth}
                  setSelectedMonth={setSelectedMonth}
                  page={page}
                  setPage={setPage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  setPageSize={setPageSize}
                  filterOpen={filterOpen}
                  setFilterOpen={setFilterOpen}
                  advancedFilters={advancedFilters}
                  setAdvancedFilters={setAdvancedFilters}
                  onAdd={() => { leaveList(null); setEditing({ ...emptyRequest }); }}
                  onEdit={(request) => { leaveList(request.id); setEditing(request); }}
                  onExport={exportCsv}
                  onExportPdf={() => printPdf('รายการที่กรอง', filtered)}
                  isLoading={isLoading}
                  error={error}
                />
              </div>
              <div className="requests-split-detail">
                {selectedRequest && (
                  <RequestDetail
                    embedded
                    request={selectedRequest}
                    onBack={() => setSelectedRequest(null)}
                    onEdit={(request) => { setSelectedRequest(null); setEditing(request); }}
                    onDelete={() => { setSelectedRequest(null); handleDeleteRequest(selectedRequest.id); }}
                  />
                )}
              </div>
            </div>
          )
        ) : (
          <Dashboard requests={requests} />
        )}
      </main>

      {filterOpen && (
        <FilterPanel
          filters={advancedFilters}
          setFilters={setAdvancedFilters}
          onClose={() => setFilterOpen(false)}
          requests={requests}
        />
      )}

      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}

const formatChipDate = (value) => {
  if (!value) return '…';
  const [y, m, d] = value.split('-');
  return d && m && y ? `${d}/${m}/${y}` : value;
};

function RequestsView({ filtered, pageItems, query, setQuery, status, setStatus, selectedMonth, setSelectedMonth, page, setPage, totalPages, pageSize, setPageSize, setFilterOpen, advancedFilters, setAdvancedFilters, onAdd, onView, onEdit, onExport, onExportPdf, isLoading, error, scrollRestoreRef, highlightId, onHighlightExpire, compact = false, selectedId = null }) {
  const monthInputRef = useRef(null);

  // กลับมาหน้ารายการแล้วเลื่อนไปตำแหน่งเดิมที่เคยอยู่ก่อนกดดู/แก้ไขงาน แทนที่จะเริ่มจากบนสุดใหม่
  useLayoutEffect(() => {
    if (scrollRestoreRef?.current) {
      window.scrollTo(0, scrollRestoreRef.current);
    }
  }, []);

  // ไฮไลต์แถวที่พึ่งกลับมาจากหน้ารายละเอียด/แก้ไข ชั่วครู่ให้หาเจอง่าย แล้วค่อยจางหายไป
  useEffect(() => {
    if (!highlightId) return undefined;
    const timer = setTimeout(() => onHighlightExpire?.(), 2600);
    return () => clearTimeout(timer);
  }, [highlightId, onHighlightExpire]);
  const activeFilterChips = useMemo(() => Object.entries(advancedFilters || {}).reduce((chips, [key, value]) => {
    const label = filterFieldLabels[key] || key;
    if (filterDateFields.includes(key)) {
      if (value && (value.from || value.to)) {
        chips.push({ key, text: `${label}: ${formatChipDate(value.from)} – ${formatChipDate(value.to)}` });
      }
      return chips;
    }
    const values = Array.isArray(value) ? value : value ? [value] : [];
    if (values.length) {
      const preview = values.length > 2 ? `${values.slice(0, 2).join(', ')} +${values.length - 2}` : values.join(', ');
      chips.push({ key, text: `${label}: ${preview}` });
    }
    return chips;
  }, []), [advancedFilters]);
  const removeFilterChip = (key) => {
    const next = { ...advancedFilters };
    delete next[key];
    setAdvancedFilters(next);
  };
  const active = useMemo(() => filtered.filter((r) => !['เรียบร้อยปกติ', 'ยกเลิก'].includes(r.status)).length, [filtered]);
  const done = useMemo(() => filtered.filter((r) => r.status === 'เรียบร้อยปกติ').length, [filtered]);
  const groupedStatuses = useMemo(() => {
    const statuses = status === 'ทั้งหมด'
      ? Array.from(new Set([...STATUS_ORDER, ...pageItems.map((request) => request.status)])).sort(
        (a, b) => statusRank(a) - statusRank(b),
      )
      : [status];
    return statuses
      .map((groupStatus) => ({
        status: groupStatus,
        items: pageItems.filter((request) => request.status === groupStatus),
      }))
      .filter((group) => group.items.length > 0);
  }, [pageItems, status]);

  return (
    <section className="view active-view" style={{ paddingTop: '16px' }}>
      <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <label className="search-box" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 0', minWidth: '0', height: '42px', border: '1px solid #dfe6e4', borderRadius: '14px', background: '#fff', padding: '0 10px 0 8px', boxShadow: '0 4px 12px rgba(24, 36, 43, 0.03)' }}>
          <span className="field-icon" aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', border: '1px solid #dfe6e4', borderRadius: '8px', background: '#f7faf9', color: '#6f7f7d', fontSize: '14px', flexShrink: 0, lineHeight: 1 }}>⌕</span>
          <input type="search" placeholder="ค้นหาลูกค้า เลขติดตาม สถานที่..." value={query} onChange={(event) => setQuery(event.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', flex: '1', font: 'inherit', color: '#18242b', padding: 0, margin: 0 }} />
        </label>
        <button className="primary-btn ui-button" onClick={onAdd} style={{ flexShrink: 0 }}><span>+</span> เพิ่มงานใหม่</button>
      </div>

      {!compact && (
        <div className="metric-row ui-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
          <Metric label="งานทั้งหมดในหน้านี้" value={filtered.length} style={{ boxShadow: '0 8px 22px rgba(24, 36, 43, 0.04)', borderRadius: '18px', padding: '14px 16px', minHeight: '112px' }} />
          <Metric label="งานที่ยังเปิดอยู่ในหน้านี้" value={active} className="accent" style={{ boxShadow: '0 8px 22px rgba(24, 36, 43, 0.04)', borderRadius: '18px', padding: '14px 16px', minHeight: '112px' }} />
          <Metric label="งานที่เสร็จแล้วในหน้านี้" value={done} style={{ boxShadow: '0 8px 22px rgba(24, 36, 43, 0.04)', borderRadius: '18px', padding: '14px 16px', minHeight: '112px' }} />
        </div>
      )}

      <div className="toolbar ui-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <label className="search-box" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 0', minWidth: '0', width: '100%', height: '42px', border: '1px solid #dfe6e4', borderRadius: '14px', background: '#fff', padding: '0 10px 0 8px', boxShadow: '0 4px 12px rgba(24, 36, 43, 0.03)' }}>
          <button type="button" className="field-icon month-picker-button" aria-label="เลือกเดือน" onClick={() => {
            const input = monthInputRef.current;
            if (!input) return;
            if (typeof input.showPicker === 'function') input.showPicker();
            else input.focus();
          }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', border: '1px solid #dfe6e4', borderRadius: '8px', background: '#f7faf9', color: '#6f7f7d', fontSize: '14px', flexShrink: 0, lineHeight: 1, padding: 0, cursor: 'pointer' }}>📆</button>
          <input ref={monthInputRef} type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', minWidth: 0, flex: '1', font: 'inherit', color: '#18242b', padding: 0, margin: 0, cursor: 'pointer' }} />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ minWidth: '170px', flex: '0 0 170px', height: '42px', borderRadius: '14px', border: '1px solid #dfe6e4', padding: '0 12px', background: '#fff', color: '#18242b', boxShadow: '0 4px 12px rgba(24, 36, 43, 0.03)' }}>
          <option>ทั้งหมด</option>
          <option>รับเรื่อง</option>
          <option>รอดำเนินการ</option>
          <option>กำลังดำเนินการ</option>
          <option>รอลูกค้าสรุปงาน</option>
          <option>รออะไหล่</option>
          <option>เรียบร้อยปกติ</option>
          <option>รอเสนอราคา</option>
        </select>
        <button className="secondary-btn ui-button" onClick={() => setFilterOpen(true)} style={{ borderRadius: '12px', height: '42px', padding: '0 14px', boxShadow: '0 4px 12px rgba(24, 36, 43, 0.03)' }}>☷ ตัวกรอง</button>
        <button className="secondary-btn" onClick={onExport} style={{ borderRadius: '12px', height: '42px', padding: '0 14px', boxShadow: '0 4px 12px rgba(24, 36, 43, 0.03)' }}>ดาวน์โหลด CSV</button>
        <button className="secondary-btn" onClick={onExportPdf} style={{ borderRadius: '12px', height: '42px', padding: '0 14px', boxShadow: '0 4px 12px rgba(24, 36, 43, 0.03)' }}>ส่งออก PDF</button>
      </div>

      {activeFilterChips.length > 0 && (
        <div className="filter-chip-row">
          {activeFilterChips.map(({ key, text }) => (
            <span className="filter-chip" key={key}>
              <span>{text}</span>
              <button type="button" onClick={() => removeFilterChip(key)} aria-label={`ลบตัวกรอง ${filterFieldLabels[key] || key}`}>×</button>
            </span>
          ))}
          <button type="button" className="filter-chip-clear" onClick={() => setAdvancedFilters({})}>ล้างทั้งหมด</button>
        </div>
      )}

      {isLoading && <div className="empty-state">กำลังโหลดข้อมูล...</div>}
      {!isLoading && error && <div className="empty-state error">{error}</div>}

      {!isLoading && !error && (
        <>
          <div className="table-wrap ui-card" style={{ background: '#fff', border: '1px solid #e4e9e8', borderRadius: '18px', overflow: 'hidden', marginBottom: '12px', boxShadow: '0 12px 32px rgba(24, 36, 43, 0.05)' }}>
            {groupedStatuses.length === 0 ? (
              <div style={{ padding: '28px 20px', color: '#718087' }}>ไม่มีงานในเงื่อนไขนี้</div>
            ) : groupedStatuses.map((group) => (
              <div key={group.status} style={{ borderBottom: '1px solid #eef1ef' }}>
                <div style={{ background: 'linear-gradient(135deg, #f4f9f9 0%, #eef3f3 100%)', padding: '10px 14px', fontSize: '14px', fontWeight: 600, color: '#18242b', borderBottom: '1px solid #e4e9e8' }}>
                  {group.status}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: compact ? '1.4fr 1.2fr 1.4fr' : '1.3fr 0.8fr 1.3fr 1.7fr 1.2fr 0.8fr', fontSize: '12px', color: '#18242b' }}>
                  {(compact ? ['ลูกค้า', 'เลขติดตาม', 'สถานที่/สาขา'] : ['ลูกค้า', 'อ้างอิง', 'เลขติดตาม', 'สถานที่/สาขา', 'ผู้ดำเนินการ', 'จัดการ']).map((label) => (
                    <div key={label} style={{ padding: '8px 10px', background: '#f7f8fc', borderBottom: '1px solid #dfe3ee', borderRight: '1px solid #eef1ef', fontWeight: 700, color: '#59627a' }}>{label}</div>
                  ))}
                  {group.items.map((request) => {
                    const rowHighlight = {
                      backgroundColor: request.id === selectedId ? '#e7f1fb' : request.id === highlightId ? '#fff4d6' : 'transparent',
                      transition: 'background-color 1.2s ease',
                    };
                    const cellStyle = { padding: '10px 10px', borderBottom: '1px solid #eef1ef', borderRight: '1px solid #eef1ef', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', ...rowHighlight };
                    return (
                    <React.Fragment key={request.id}>
                      <div style={cellStyle} onClick={() => onView(request)}>{request.customer || '—'}</div>
                      {compact ? (
                        <>
                          <div style={cellStyle} onClick={() => onView(request)}>{request.ticket || '-'}</div>
                          <div style={cellStyle} onClick={() => onView(request)}>{request.location || '—'}</div>
                        </>
                      ) : (
                        <>
                          <div style={cellStyle} onClick={() => onView(request)}>{request.ref || '-'}</div>
                          <div style={cellStyle} onClick={() => onView(request)}>{request.ticket || '-'}</div>
                          <div style={cellStyle} onClick={() => onView(request)}>{request.location || '—'}</div>
                          <div style={cellStyle} onClick={() => onView(request)}>{request.assignee || '—'}</div>
                          <div style={{ padding: '8px 8px', borderBottom: '1px solid #eef1ef', display: 'flex', alignItems: 'center', justifyContent: 'center', ...rowHighlight }}>
                            <button type="button" className="secondary-btn" onClick={(event) => { event.stopPropagation(); onEdit(request); }}>แก้ไข</button>
                          </div>
                        </>
                      )}
                    </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#718087', fontSize: '12px' }}>หน้า</span>
              <button type="button" className="secondary-btn" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>ก่อนหน้า</button>
              <span style={{ fontSize: '12px', color: '#18242b' }}>{page} / {totalPages}</span>
              <button type="button" className="secondary-btn" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>ถัดไป</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#718087', fontSize: '12px' }}>แสดง</span>
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} style={{ height: '36px', borderRadius: '6px', border: '1px solid #dfe5e4', background: '#fff', padding: '0 8px' }}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Metric({ label, value, className = '', style = {} }) {
  return (
    <div className="metric" style={{ background: '#fff', border: '1px solid #edf0ef', borderRadius: '18px', boxShadow: '0 8px 22px rgba(24, 36, 43, 0.04)', padding: '16px', ...style }}>
      <label style={{ display: 'block', fontSize: '13px', color: '#718087', marginBottom: '10px' }}>{label}</label>
      <strong className={className} style={{ display: 'block', fontSize: '28px', lineHeight: 1.2, color: '#18242b' }}>{value}</strong>
    </div>
  );
}

// ดึงค่าที่เคยกรอกจริงจากประวัติงาน (requests) มาเป็นตัวเลือกในดรอปดาวน์
// เพื่อให้ลูกค้า/สถานที่/ผู้ดำเนินการ ที่เคยมีอยู่จริงเลือกซ้ำได้ ไม่ต้องพิมพ์ใหม่ทุกครั้ง
const uniqueSorted = (values) => Array.from(new Set(values.map((v) => String(v || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'th'));

const deriveOptionsFromRequests = (requests) => ({
  customer: uniqueSorted(requests.map((r) => r.customer)),
  location: uniqueSorted(requests.map((r) => r.location)),
  // ผู้ดำเนินการเก่าบางงานพิมพ์รวมกันเป็นสตริงเดียวคั่นด้วย "," (เช่น "PLAY, อีฟ")
  // แยกออกเป็นชื่อเดี่ยวๆ ก่อน ไม่ให้ตัวเลือกในดรอปดาวน์เหลือเป็นก้อนรวมชื่อ
  assignee: uniqueSorted(requests.flatMap((r) => String(r.assignee || '').split(','))),
});

const mergeOptions = (...lists) => uniqueSorted(lists.flat());

// เอาค่าที่ผู้ใช้กดลบทิ้งไว้ (hidden) ออกจากรายการ ไม่ว่าค่านั้นจะมาจากที่พิมพ์เพิ่มเองหรือดึงจากประวัติงานจริง
const excludeHidden = (options, hiddenList = []) => options.filter((opt) => !hiddenList.includes(opt));

function RequestEditor({ request, requests = [], onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({
    ...emptyRequest,
    ...normalizeRequest(request),
    receivedAt: request.id ? toDateTimeLocalValue(request.receivedAt) : toDateTimeLocalValue(),
    appointment: request.appointment ? toDateTimeLocalValue(request.appointment) : '',
    appointmentEnd: request.appointmentEnd ? toDateTimeLocalValue(request.appointmentEnd) : '',
    completedAt: request.completedAt ? toDateTimeLocalValue(request.completedAt) : '',
    ticket: request.ticket || '',
  }));
  const [dropdownData, setDropdownData] = useState(getStoredDropdownData());
  const [isSaving, setIsSaving] = useState(false);

  const historyOptions = useMemo(() => deriveOptionsFromRequests(requests), [requests]);

  const update = (event) => {
    const nextForm = { ...form, [event.target.name]: event.target.value };
    setForm(nextForm);
  };

  const handleAddDropdownValue = (field, value) => {
    addDropdownValue(field, value);
    const newData = getStoredDropdownData();
    setDropdownData(newData);
  };

  const handleRemoveDropdownValue = (field, value) => {
    removeDropdownValue(field, value);
    const newData = getStoredDropdownData();
    setDropdownData(newData);
  };

  const text = (name, label, required = false, type = 'text') => (
    <label key={name} className="editor-field">
      <span>{label}{required && <em>*</em>}</span>
      <input name={name} type={type} value={form[name] || ''} onChange={update} required={required} />
    </label>
  );

  const textarea = (name, label, required = false) => (
    <label key={name} className="editor-field editor-field-span">
      <span>{label}{required && <em>*</em>}</span>
      <textarea name={name} rows={4} value={form[name] || ''} onChange={update} required={required} />
    </label>
  );

  return (
    <section className="view active-view">
      <div className="editor-shell">
        <div className="form-topbar">
          <button type="button" className="icon-btn" onClick={onClose}>×</button>
          <h2>{request.id ? 'แก้ไขงาน' : 'เพิ่มงานใหม่'}</h2>
          <div>
            {request.id && (
              <button
                type="button"
                className="icon-btn"
                title="ลบงานนี้"
                onClick={onDelete}
                style={{ color: '#dc5b56', marginRight: '8px' }}
              >
                🗑️
              </button>
            )}
            <button type="button" className="secondary-btn" onClick={onClose}>ยกเลิก</button>
            <button type="submit" form="serviceForm" className="primary-btn" disabled={isSaving}>
              {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>

        <form id="serviceForm" className="editor-form" onSubmit={async (event) => {
          event.preventDefault();
          if (isSaving) return;
          setIsSaving(true);
          try {
            await onSave(form);
          } finally {
            setIsSaving(false);
          }
        }}>
          <div className="editor-grid">
            {text('ref', 'Ref.', true)}
            <EditableDropdown
              name="source"
              label="แหล่งที่มา"
              value={form.source || ''}
              options={dropdownData.source || ['ไลน์', 'โทรศัพท์', 'อีเมล', 'เว็บไซต์']}
              onChange={update}
              onAddOption={(value) => {
                handleAddDropdownValue('source', value);
                update({ target: { name: 'source', value } });
              }}
              onRemoveOption={(value) => handleRemoveDropdownValue('source', value)}
            />
            {text('receivedAt', 'วันเวลาที่รับแจ้ง', true, 'datetime-local')}
            {!request.id && <div className="field-hint editor-field editor-field-span">เลขติดตามจะถูกสร้างอัตโนมัติหลังบันทึก</div>}
            {request.id && text('ticket', 'เลขติดตาม', false)}
            <EditableDropdown
              name="customer"
              label="ลูกค้า"
              value={form.customer || ''}
              options={excludeHidden(mergeOptions(dropdownData.customer || [], historyOptions.customer), dropdownData.hidden?.customer)}
              onChange={update}
              onAddOption={(value) => {
                handleAddDropdownValue('customer', value);
                update({ target: { name: 'customer', value } });
              }}
              onRemoveOption={(value) => handleRemoveDropdownValue('customer', value)}
              required
            />
            <EditableDropdown
              name="location"
              label="สถานที่/สาขา"
              value={form.location || ''}
              options={excludeHidden(mergeOptions(dropdownData.location || [], historyOptions.location), dropdownData.hidden?.location)}
              onChange={update}
              onAddOption={(value) => {
                handleAddDropdownValue('location', value);
                update({ target: { name: 'location', value } });
              }}
              onRemoveOption={(value) => handleRemoveDropdownValue('location', value)}
              required
            />
            {text('site', 'สถานที่ตั้ง')}
            {text('contact', 'ผู้ติดต่อ')}
            {text('phone', 'เบอร์ติดต่อ')}
            {textarea('description', 'ข้อมูลการรับแจ้ง', true)}
            <div className="editor-field editor-field-span">
              <FileField name="image" label="รูปภาพที่แจ้ง" value={form.image} onChange={update} />
            </div>
            <div className="field-group editor-field">
              <span>MA</span>
              <div className="segmented">
                <button type="button" className={form.ma === 'N' ? 'selected' : ''} onClick={() => setForm({ ...form, ma: form.ma === 'N' ? '' : 'N' })}>N</button>
                <button type="button" className={form.ma === 'Y' ? 'selected' : ''} onClick={() => setForm({ ...form, ma: form.ma === 'Y' ? '' : 'Y' })}>Y</button>
              </div>
            </div>
            <EditableDropdown
              name="jobType"
              label="ลักษณะงาน"
              value={form.jobType || ''}
              options={dropdownData.jobType || ['แนะนำ', 'แก้ไขหน้างาน', 'รีโมท', 'ประเมินราคา', 'เทรน']}
              onChange={update}
              onAddOption={(value) => {
                handleAddDropdownValue('jobType', value);
                update({ target: { name: 'jobType', value } });
              }}
              onRemoveOption={(value) => handleRemoveDropdownValue('jobType', value)}
              required
            />
            <EditableDropdown
              name="status"
              label="สถานะงาน"
              value={form.status || ''}
              options={dropdownData.status || STATUS_ORDER}
              onChange={update}
              onAddOption={(value) => {
                handleAddDropdownValue('status', value);
                update({ target: { name: 'status', value } });
              }}
              onRemoveOption={(value) => handleRemoveDropdownValue('status', value)}
              required
            />
            <EditableDropdown
              name="assignee"
              label="ผู้ดำเนินการ"
              value={form.assignee || ''}
              options={excludeHidden(mergeOptions(dropdownData.assignee || [], historyOptions.assignee), dropdownData.hidden?.assignee).filter((opt) => !opt.includes(','))}
              onChange={update}
              onAddOption={(value) => {
                handleAddDropdownValue('assignee', value);
                update({ target: { name: 'assignee', value } });
              }}
              onRemoveOption={(value) => handleRemoveDropdownValue('assignee', value)}
              multiple
            />
            {form.status === 'กำลังดำเนินการ' && (
              <>
                {text('appointment', 'วันที่นัดหมาย เวลาเริ่มต้น', false, 'datetime-local')}
                {text('appointmentEnd', 'วันที่นัดหมาย เวลาสิ้นสุด', false, 'datetime-local')}
              </>
            )}
            <EditableDropdown
              name="equipment"
              label="เกี่ยวกับอุปกรณ์"
              value={form.equipment || ''}
              options={dropdownData.equipment || ['จอ LED', 'Kiosk', 'กล่องเล่นสื่อ', 'อื่นๆ']}
              onChange={update}
              onAddOption={(value) => {
                handleAddDropdownValue('equipment', value);
                update({ target: { name: 'equipment', value } });
              }}
              onRemoveOption={(value) => handleRemoveDropdownValue('equipment', value)}
            />
            <div className="editor-field editor-field-span">
              <FileField name="completedImage" label="รูปภาพที่ดำเนินการเสร็จแล้ว" value={form.completedImage} onChange={update} />
            </div>
            {text('completedAt', 'วันเวลาเสร็จ', false, 'datetime-local')}
            {text('map', 'MAP')}
            {text('vehicle', 'ทะเบียนรถ')}
            {textarea('action', 'รายละเอียดการดำเนินการ')}
            {textarea('notes', 'หมายเหตุ')}
            {text('file', 'ไฟล์', false, 'url')}
          </div>
        </form>
      </div>
    </section>
  );
}

function FileField({ name, label, value, onChange }) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      await Swal.fire({
        icon: 'warning',
        title: 'ไฟล์ไม่ถูกต้อง',
        text: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#ef765e',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      await Swal.fire({
        icon: 'warning',
        title: 'ไฟล์มีขนาดใหญ่เกินไป',
        text: 'กรุณาเลือกไฟล์ภาพขนาดไม่เกิน 10 MB',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#ef765e',
      });
      return;
    }

    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name}`;
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const base64 = reader.result.split(',')[1];
          const uploadResponse = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file: base64,
              fileName,
              bucket: 'service-desk-images',
            }),
          });

          if (!uploadResponse.ok) {
            throw new Error('Upload failed');
          }

          const { url } = await uploadResponse.json();
          onChange({ target: { name, value: url } });

          await Swal.fire({
            icon: 'success',
            title: 'อัพโหลดสำเร็จ',
            text: 'รูปภาพถูกอัพโหลดเสร็จแล้ว',
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#5b5ce2',
            timer: 1500,
            timerProgressBar: true,
          });
        } catch (uploadError) {
          await Swal.fire({
            icon: 'error',
            title: 'อัพโหลดไม่สำเร็จ',
            text: uploadError instanceof Error ? uploadError.message : 'ไม่สามารถอัพโหลดรูปภาพได้',
            confirmButtonText: 'ปิด',
            confirmButtonColor: '#ef765e',
          });
        } finally {
          setIsUploading(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: error instanceof Error ? error.message : 'ไม่สามารถประมวลผลไฟล์ได้',
        confirmButtonText: 'ปิด',
        confirmButtonColor: '#ef765e',
      });
      setIsUploading(false);
    }
  };

  return (
    <label className="file-field">
      {label}
      <input
        name={name}
        type="file"
        accept="image/*"
        onChange={handleFile}
        disabled={isUploading}
      />
      <span>{isUploading ? '⟳' : '▣'}</span>
      {value && (isViewableImageUrl(value) ? (
        <img className="image-preview" src={value} alt="ตัวอย่างรูปภาพ" />
      ) : (
        <em className="image-unavailable">ไม่มีไฟล์รูปภาพ (ข้อมูลนำเข้าเก่า หารูปต้นฉบับไม่พบ)</em>
      ))}
    </label>
  );
}

export default App;
