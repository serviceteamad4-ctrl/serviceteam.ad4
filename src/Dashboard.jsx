import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';

const normalizeJobType = (value) => {
  // ข้อมูลบางแถวพิมพ์ "แ" เป็น "เ" สองตัวติดกัน (เเก้ไขสื่อ) ให้รวมเป็นตัวเดียวก่อนเทียบ
  const text = String(value || '').trim().toLowerCase().replace(/เเ/g, 'แ');

  if (!text) return 'งานแจ้งซ่อม';
  if (['เทรน', 'training', 'อบรม'].some((label) => text.includes(label.toLowerCase()))) {
    return 'งานเทรน';
  }
  // ต้องเช็ค "แก้ไขสื่อ" ก่อนกลุ่มส่งสื่อ เพราะกลุ่มส่งสื่อมีคำกว้างๆ อย่าง 'สื่อ' ซึ่งจะดูดงานแก้ไขสื่อไปนับเป็นส่งสื่อหมด
  if (['งานแก้ไขสื่อ', 'แก้ไขสื่อ'].some((label) => text.includes(label.toLowerCase()))) {
    return 'งานแก้ไขสื่อ';
  }
  if (['งานขึ้นสื่อ', 'งานส่งสื่อ', 'ขึ้นสื่อ', 'ส่งสื่อ', 'สื่อ'].some((label) => text.includes(label.toLowerCase()))) {
    return 'งานส่งสื่อ';
  }
  return 'งานแจ้งซ่อม';
};

const groupedTypeCount = (items) => {
  const result = { 'งานส่งสื่อ': 0, 'งานแก้ไขสื่อ': 0, 'งานแจ้งซ่อม': 0, 'งานเทรน': 0 };

  items.forEach((item) => {
    const group = normalizeJobType(item.jobType);
    result[group] += 1;
  });

  return result;
};

const todayInBangkok = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// receivedAt/completedAt เก็บเป็น UTC ISO string การตัด 10 ตัวแรก (.slice(0,10)) จะได้ "วันที่ตาม UTC"
// ไม่ใช่วันที่ตามเวลาไทย งานที่รับแจ้งช่วงเที่ยงคืน-ตี 6 ของไทย (ซึ่งยังเป็น UTC วันก่อนหน้า) จะถูกนับตกหล่นไปวันก่อน
// ต้องแปลงเป็นวันที่ตาม Asia/Bangkok ก่อนเทียบเสมอ
const toBangkokDate = (isoValue) => isoValue
  ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(isoValue))
  : '';

export default function Dashboard({ requests }) {
  const [date, setDate] = useState(todayInBangkok);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef(null);

  // ถ่ายภาพตารางรายงานประจำวันตามที่แสดงจริงบนหน้าจอ แล้วบันทึกเป็นไฟล์ PNG
  const exportPng = async () => {
    if (!reportRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `dashboard-รายวัน-${date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setIsExporting(false);
    }
  };
  // แปลงจาก yyyy-mm-dd (ของ input date) เป็น วัน/เดือน/ปี ให้อ่านง่ายแบบไทย
  const formattedDate = date ? date.split('-').reverse().join('/') : '';
  const dayRequests = requests.filter((item) => toBangkokDate(item.receivedAt) === date);
  const completed = requests.filter((item) => toBangkokDate(item.completedAt) === date && item.status === 'เรียบร้อยปกติ');
  const dayGroups = groupedTypeCount(dayRequests);
  const completedGroups = groupedTypeCount(completed);

  const allRequests = requests;
  const allRows = [
    { number: '4', label: 'รอจัดคิวช่าง', value: allRequests.filter((item) => ['รอคิวช่าง', 'รอจัดคิวช่าง'].includes(item.status)).length, tone: 'green', children: [] },
    { number: '5', label: 'กำลังดำเนินการ', value: allRequests.filter((item) => item.status === 'กำลังดำเนินการ').length, tone: 'blue', children: [] },
    { number: '6', label: 'รอลูกค้าสรุป', value: allRequests.filter((item) => item.status === 'รอลูกค้าสรุปงาน').length, tone: 'amber', children: [] },
    { number: '7', label: 'รอส่งตามวันที่', value: allRequests.filter((item) => ['รอส่งสื่อ', 'รอส่งสื่อตามวันที่ลูกค้ากำหนด'].includes(item.status)).length, tone: 'purple', children: [] },
    { number: '8', label: 'เสนอราคา/รออนุมัติ', value: allRequests.filter((item) => item.status === 'รอเสนอราคา').length, tone: 'gray', children: [] },
    { number: '9', label: 'รออะไหล่', value: allRequests.filter((item) => item.status === 'รออะไหล่').length, tone: 'green', children: [] },
    { number: '10', label: 'ติดตาม/ไม่ทันเวลา', value: allRequests.filter((item) => item.notes?.includes('ไม่ทัน')).length, tone: 'gray', children: [] },
    { number: '11', label: 'งานที่เปิดอยู่', value: allRequests.filter((item) => !['ยกเลิก', 'เรียบร้อยปกติ'].includes(item.status)).length, tone: 'blue', children: [] },
  ];

  const rows = [
    {
      number: '1',
      label: 'ประเภทงาน',
      value: dayRequests.length,
      tone: 'purple',
      children: [
        ['ส่งสื่อ', dayGroups['งานส่งสื่อ']],
        ['แก้ไขสื่อ', dayGroups['งานแก้ไขสื่อ']],
        ['แจ้งซ่อม', dayGroups['งานแจ้งซ่อม']],
        ['เทรน', dayGroups['งานเทรน']],
      ],
    },
    {
      number: '2',
      label: 'สำเร็จวันนี้',
      value: completed.length,
      tone: 'blue',
      children: [
        ['ส่งสื่อ', completedGroups['งานส่งสื่อ']],
        ['แก้ไขสื่อ', completedGroups['งานแก้ไขสื่อ']],
        ['แจ้งซ่อม', completedGroups['งานแจ้งซ่อม']],
        ['เทรน', completedGroups['งานเทรน']],
      ],
    },
    {
      number: '3',
      label: 'รับเรื่อง',
      value: allRequests.filter((item) => item.status === 'รับเรื่อง').length,
      tone: 'yellow',
      children: [],
    },
    ...allRows,
  ];

  return (
    <section className="dashboard-page view active-view">
      <div className="page-heading">
        <div>
          <p className="eyebrow">REPORTS / DAILY OPERATIONS</p>
          <h1>Dashboard รายงานประจำวัน</h1>
          <p className="subheading">สรุปสถานะงานบริการจากข้อมูลของคุณ</p>
        </div>
        <div className="dashboard-actions">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <button className="secondary-btn" onClick={exportPng} disabled={isExporting}>
            {isExporting ? 'กำลังส่งออก...' : 'ส่งออก PNG'}
          </button>
        </div>
      </div>

      <div className="daily-sheet-card" ref={reportRef}>
        <div className="daily-sheet">
          <div className="sheet-row">
            <div className="sheet-date">{formattedDate}</div>
            <div className="sheet-label">เคสทั้งหมด</div>
            <div className="sheet-value">{dayRequests.length}</div>
          </div>
          {rows.map((row) => <ReportRow key={row.number} row={row} />)}
        </div>
      </div>
    </section>
  );
}

function ReportRow({ row }) {
  return (
    <>
      <div className="sheet-row">
        <div className="sheet-number">{row.number}</div>
        <div className={`sheet-label ${row.tone}`}>{row.label}</div>
        <div className={`sheet-value ${row.tone}`}>{row.value}</div>
      </div>
      {row.children.map(([label, value]) => <ReportChild key={label} label={label} value={value} />)}
    </>
  );
}

function ReportChild({ label, value }) {
  return (
    <div className="sheet-row sheet-row-child">
      <div />
      <div className="sheet-child">{label}</div>
      <div className="sheet-child-value">{value}</div>
    </div>
  );
}
