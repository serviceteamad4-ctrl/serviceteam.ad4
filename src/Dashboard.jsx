import { useState } from 'react';

const normalizeJobType = (value) => {
  const text = String(value || '').trim().toLowerCase();

  if (!text) return 'งานแจ้งซ่อม';
  if (['งานขึ้นสื่อ', 'งานส่งสื่อ', 'ขึ้นสื่อ', 'ส่งสื่อ', 'สื่อ'].some((label) => text.includes(label.toLowerCase()))) {
    return 'งานส่งสื่อ';
  }
  if (['งานแก้ไขสื่อ', 'แก้ไขสื่อ'].some((label) => text.includes(label.toLowerCase()))) {
    return 'งานแก้ไขสื่อ';
  }
  return 'งานแจ้งซ่อม';
};

const groupedTypeCount = (items) => {
  const result = { 'งานส่งสื่อ': 0, 'งานแก้ไขสื่อ': 0, 'งานแจ้งซ่อม': 0 };

  items.forEach((item) => {
    const group = normalizeJobType(item.jobType);
    result[group] += 1;
  });

  return result;
};

export default function Dashboard({ requests, onExport }) {
  const [date, setDate] = useState('2026-08-28');
  const dayRequests = requests.filter((item) => item.receivedAt?.slice(0, 10) === date);
  const completed = requests.filter((item) => item.completedAt?.slice(0, 10) === date && item.status === 'เรียบร้อยปกติ');
  const dayGroups = groupedTypeCount(dayRequests);
  const completedGroups = groupedTypeCount(completed);

  const allRequests = requests;
  const allRows = [
    { number: '3', label: 'อัปเดตแผนงาน', value: 8, tone: 'yellow', children: [['สถานะ', '']] },
    { number: '4', label: 'รอคิวช่าง', value: allRequests.filter((item) => item.status === 'รอคิวช่าง').length, tone: 'green', children: [['', '']] },

    { number: '5', label: 'กำลังดำเนินการ', value: allRequests.filter((item) => item.status === 'กำลังดำเนินการ').length, tone: 'blue', children: [] },
    { number: '6', label: 'รอลูกค้าสรุป', value: allRequests.filter((item) => item.status === 'รอลูกค้าสรุปงาน').length, tone: 'amber', children: [] },
    { number: '7', label: 'รอส่งตามวันที่', value: allRequests.filter((item) => ['รอส่งสื่อ', 'รอส่งสื่อตามวันที่ลูกค้ากำหนด'].includes(item.status)).length, tone: 'purple', children: [] },
    { number: '8', label: 'เสนอราคา/รออนุมัติ', value: allRequests.filter((item) => ['เสนอราคา', 'รอเสนอราคา'].includes(item.status)).length, tone: 'gray', children: [] },
    { number: '9', label: 'รออะไหล่', value: allRequests.filter((item) => item.status === 'รออะไหล่').length, tone: 'green', children: [] },
    { number: '10', label: 'ติดตาม/ไม่ทันเวลา', value: allRequests.filter((item) => item.notes?.includes('ไม่ทัน')).length, tone: 'gray', children: [] },
  ];

  const rows = [
    { number: '1', label: 'ประเภทงาน', value: dayRequests.length, tone: 'purple', children: [['ส่งสื่อ', dayGroups['งานส่งสื่อ']], ['แก้ไขสื่อ', dayGroups['งานแก้ไขสื่อ']], ['แจ้งซ่อม', dayGroups['งานแจ้งซ่อม']]] },
    { number: '2', label: 'สำเร็จวันนี้', value: completed.length, tone: 'blue', children: [['ส่งสื่อ', completedGroups['งานส่งสื่อ']], ['แก้ไขสื่อ', completedGroups['งานแก้ไขสื่อ']], ['แจ้งซ่อม', completedGroups['งานแจ้งซ่อม']]] },
    ...allRows
  ];

  return <section className="dashboard-page view active-view"><div className="page-heading"><div><p className="eyebrow">REPORTS / DAILY OPERATIONS</p><h1>Dashboard รายงานประจำวัน</h1><p className="subheading">สรุปสถานะงานบริการจากข้อมูลของคุณ</p></div><div className="dashboard-actions"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><button className="secondary-btn" onClick={onExport}>ส่งออก PDF</button></div></div><div className="daily-sheet"><div className="sheet-date">{date}</div><div className="sheet-label">เคสทั้งหมด</div><div className="sheet-value">{dayRequests.length}</div><div className="sheet-note" />{rows.map((row) => <ReportRow key={row.number} row={row} />)}</div></section>;
}

function ReportRow({ row }) { return <><div className="sheet-number">{row.number}</div><div className={`sheet-label ${row.tone}`}>{row.label}</div><div className={`sheet-value ${row.tone}`}>{row.value}</div><div className="sheet-note" />{row.children.map(([label, value]) => <ReportChild key={label} label={label} value={value} />)}</>; }

function ReportChild({ label, value }) { return <><div /><div className="sheet-child">{label}</div><div className="sheet-child-value">{value}</div><div /></>; }