import * as XLSX from 'xlsx';

const FIELD_ALIASES = {
  customer: ['ลูกค้า', 'Customer', 'Customer Name'],
  location: ['สถานที่', 'Location', 'Site', 'สถานที่สาขา', 'สถานที่/สาขา'],
  assignee: ['ผู้ดำเนินการ', 'Assignee', 'Technician'],
  source: ['ช่องทาง', 'Source', 'Channel'],
  jobType: ['ลักษณะงาน', 'Job Type', 'ประเภทงาน'],
  status: ['สถานะ', 'Status'],
  equipment: ['อุปกรณ์', 'Equipment'],
};

export const extractDataFromExcel = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        const extracted = {
          customer: new Set(),
          location: new Set(),
          assignee: new Set(),
          source: new Set(),
          jobType: new Set(),
          status: new Set(),
          equipment: new Set(),
        };

        rows.forEach((row) => {
          Object.keys(extracted).forEach((field) => {
            FIELD_ALIASES[field].forEach((alias) => {
              if (row[alias]) {
                extracted[field].add(String(row[alias]).trim());
              }
            });
          });
        });

        resolve({
          customer: Array.from(extracted.customer).filter(Boolean),
          location: Array.from(extracted.location).filter(Boolean),
          assignee: Array.from(extracted.assignee).filter(Boolean),
          source: Array.from(extracted.source).filter(Boolean),
          jobType: Array.from(extracted.jobType).filter(Boolean),
          status: Array.from(extracted.status).filter(Boolean),
          equipment: Array.from(extracted.equipment).filter(Boolean),
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};

const DEFAULT_DROPDOWN_DATA = {
  customer: [],
  location: [],
  assignee: [],
  source: ['ไลน์', 'โทรศัพท์', 'อีเมล', 'เว็บไซต์'],
  jobType: ['แนะนำ', 'แก้ไขหน้างาน', 'รีโมท', 'ประเมินราคา', 'เทรน'],
  status: ['รับเรื่อง', 'รอดำเนินการ', 'กำลังดำเนินการ', 'รอลูกค้าสรุปงาน', 'รอส่งสื่อตามวันที่ลูกค้ากำหนด', 'รออะไหล่', 'รอเสนอราคา', 'รอจัดคิวช่าง', 'เรียบร้อยปกติ', 'ยกเลิก'],
  equipment: ['จอ LED', 'Kiosk', 'กล่องเล่นสื่อ', 'อื่นๆ'],
  // ค่าที่ผู้ใช้ลบทิ้งจากดรอปดาวน์ (รวมถึงค่าที่ดึงมาจากประวัติงานจริง) จะถูกจำไว้ที่นี่
  // เพื่อไม่ให้กลับมาโผล่อีกแม้จะยังมีอยู่ในข้อมูลเก่า
  hidden: {},
};

// รวมค่า default ในโค้ดกับค่าที่เคยบันทึกไว้ใน localStorage ของเบราว์เซอร์นั้นๆ เข้าด้วยกัน (ไม่ใช่แทนที่)
// ถ้าแทนที่ตรงๆ ตัวเลือกใหม่ที่เพิ่มเข้ามาในโค้ดทีหลัง (เช่นสถานะใหม่) จะไม่โผล่ให้ผู้ใช้ที่เคย
// กด "เพิ่ม/ลบ" ตัวเลือกอื่นมาก่อน เพราะ localStorage เก็บ list เก่าทับไว้อยู่แล้ว
export const getStoredDropdownData = () => {
  try {
    const stored = localStorage.getItem('dropdown-data');
    const parsed = stored ? JSON.parse(stored) : {};
    const hidden = parsed.hidden || {};
    const merged = { ...DEFAULT_DROPDOWN_DATA, ...parsed, hidden };

    Object.keys(DEFAULT_DROPDOWN_DATA).forEach((field) => {
      if (field === 'hidden') return;
      const combined = Array.from(new Set([...(DEFAULT_DROPDOWN_DATA[field] || []), ...(parsed[field] || [])]));
      merged[field] = combined.filter((value) => !(hidden[field] || []).includes(value));
    });

    return merged;
  } catch {
    return { ...DEFAULT_DROPDOWN_DATA };
  }
};

export const saveDropdownData = (data) => {
  localStorage.setItem('dropdown-data', JSON.stringify(data));
};

export const addDropdownValue = (field, value) => {
  const data = getStoredDropdownData();
  const newValue = String(value).trim();
  if (newValue && !data[field]?.includes(newValue)) {
    if (!data[field]) data[field] = [];
    data[field].push(newValue);
    // เพิ่มค่าใหม่แล้ว ถ้าเคยถูกซ่อนไว้ก่อนหน้านี้ก็ให้เลิกซ่อน
    if (data.hidden?.[field]) {
      data.hidden[field] = data.hidden[field].filter((item) => item !== newValue);
    }
    saveDropdownData(data);
  }
};

// ลบตัวเลือกออกจากดรอปดาวน์ ใช้ได้ทั้งค่าที่พิมพ์เพิ่มเองและค่าที่ดึงมาจากประวัติงานจริง
export const removeDropdownValue = (field, value) => {
  const data = getStoredDropdownData();
  if (data[field]) {
    data[field] = data[field].filter((item) => item !== value);
  }
  if (!data.hidden) data.hidden = {};
  if (!data.hidden[field]) data.hidden[field] = [];
  if (!data.hidden[field].includes(value)) {
    data.hidden[field].push(value);
  }
  saveDropdownData(data);
};
