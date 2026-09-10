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

export const getStoredDropdownData = () => {
  try {
    const stored = localStorage.getItem('dropdown-data');
    const defaults = {
      customer: [],
      location: [],
      assignee: [],
      source: ['ไลน์', 'โทรศัพท์', 'อีเมล', 'เว็บไซต์'],
      jobType: ['แนะนำ', 'แก้ไขหน้างาน', 'รีโมท', 'ประเมินราคา'],
      status: ['รับเรื่อง', 'รอดำเนินการ', 'กำลังดำเนินการ', 'รอลูกค้าสรุปงาน', 'เรียบร้อยปกติ', 'รอเสนอราคา'],
      equipment: ['จอ LED', 'Kiosk', 'กล่องเล่นสื่อ', 'อื่นๆ'],
    };
    return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
  } catch {
    return {
      customer: [],
      location: [],
      assignee: [],
      source: ['ไลน์', 'โทรศัพท์', 'อีเมล', 'เว็บไซต์'],
      jobType: ['แนะนำ', 'แก้ไขหน้างาน', 'รีโมท', 'ประเมินราคา'],
      status: ['รับเรื่อง', 'รอดำเนินการ', 'กำลังดำเนินการ', 'รอลูกค้าสรุปงาน', 'เรียบร้อยปกติ', 'รอเสนอราคา'],
      equipment: ['จอ LED', 'Kiosk', 'กล่องเล่นสื่อ', 'อื่นๆ'],
    };
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
    saveDropdownData(data);
  }
};

export const removeDropdownValue = (field, value) => {
  const data = getStoredDropdownData();
  if (data[field]) {
    data[field] = data[field].filter((item) => item !== value);
    saveDropdownData(data);
  }
};
