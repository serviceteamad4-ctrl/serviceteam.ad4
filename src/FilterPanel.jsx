import { useState } from 'react';

const primaryFilterFields = [
  ['ref', 'Ref.'],
  ['status', 'สถานะงาน'],
  ['customer', 'ลูกค้า'],
  ['location', 'สถานที่/สาขา'],
  ['receivedAt', 'วันเวลาที่รับแจ้ง'],
  ['completedAt', 'วันเวลาเสร็จ'],
  ['jobType', 'ลักษณะงาน'],
  ['assignee', 'ผู้ดำเนินการ'],
  ['source', 'แหล่งที่มา'],
];

const advancedFilterFields = [
  ['ticket', 'เลขที่ติดตามงาน'],
  ['site', 'สถานที่ตั้ง'],
  ['contact', 'ผู้ติดต่อ'],
  ['phone', 'เบอร์ติดต่อ'],
  ['description', 'ข้อมูลการรับแจ้ง'],
  ['appointment', 'วันที่นัดหมาย เวลาเริ่มต้น'],
  ['appointmentEnd', 'วันที่นัดหมาย เวลาสิ้นสุด'],
  ['action', 'รายละเอียดการดำเนินการ'],
  ['result', 'ผลการดำเนินการ'],
  ['equipment', 'เกี่ยวกับอุปกรณ์'],
  ['vehicle', 'ทะเบียนรถ'],
  ['notes', 'หมายเหตุ'],
  ['file', 'ไฟล์'],
];

const filterFields = [...primaryFilterFields, ...advancedFilterFields];

const dateFields = ['receivedAt', 'appointment', 'appointmentEnd', 'completedAt'];
const selectOnlyFields = ['ref'];
const dropdownFields = ['status', 'source', 'jobType', 'equipment'];
const refOptions = ['P1', 'P2', 'P3', 'PM'];

const fallbackOptions = {
  source: ['ไลน์', 'โทรศัพท์', 'อีเมล', 'เว็บไซต์'],
  jobType: ['แนะนำ', 'แก้ไขหน้างาน', 'รีโมท', 'ประเมินราคา'],
  status: ['รับเรื่อง', 'รอดำเนินการ', 'กำลังดำเนินการ', 'รอลูกค้าสรุปงาน', 'เรียบร้อยปกติ', 'รอเสนอราคา'],
  equipment: ['จอ LED', 'Kiosk', 'กล่องเล่นสื่อ', 'อื่นๆ'],
  ref: refOptions,
};

export default function FilterPanel({ filters, setFilters, onClose, requests = [] }) {
  const [activeField, setActiveField] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchText, setSearchText] = useState('');

  const valuesFor = (key) => {
    if (key === 'ref') return refOptions;
    if (dropdownFields.includes(key)) {
      return [...new Set((requests.map((item) => item[key]).filter(Boolean).length ? requests.map((item) => item[key]).filter(Boolean) : fallbackOptions[key] || []))];
    }
    return [];
  };

  const selected = (key) => Array.isArray(filters[key]) ? filters[key] : filters[key] ? [filters[key]] : [];
  const toggle = (key, value) => {
    const current = selected(key);
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    setFilters({ ...filters, [key]: next });
  };

  const handleTextSearch = (key, value) => {
    setFilters({ ...filters, [key]: value || undefined });
  };

  const handleDateChange = (key, value) => {
    setFilters({ ...filters, [key]: value || undefined });
  };

  const label = filterFields.find(([key]) => key === activeField)?.[1];
  const visibleFields = showAdvanced ? filterFields : primaryFilterFields;

  const renderFilterContent = () => {
    if (!activeField) return null;

    if (dateFields.includes(activeField)) {
      return (
        <div style={{ padding: '16px' }}>
          <label style={{ display: 'block', marginBottom: '12px' }}>
            <span style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#666' }}>เลือกวันเวลา</span>
            <input
              type="datetime-local"
              value={filters[activeField] || ''}
              onChange={(e) => handleDateChange(activeField, e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
          </label>
        </div>
      );
    }

    if (selectOnlyFields.includes(activeField)) {
      return (
        <div className="filter-options">
          {valuesFor(activeField).map((value) => (
            <label className="check-option" key={value}>
              <input
                type="checkbox"
                checked={selected(activeField).includes(value)}
                onChange={() => toggle(activeField, value)}
              />
              <span>{value}</span>
            </label>
          ))}
        </div>
      );
    }

    if (dropdownFields.includes(activeField)) {
      const options = valuesFor(activeField);
      return (
        <div className="filter-options">
          {options.map((value) => (
            <label className="check-option" key={value}>
              <input
                type="checkbox"
                checked={selected(activeField).includes(value)}
                onChange={() => toggle(activeField, value)}
              />
              <span>{value}</span>
            </label>
          ))}
          {options.length === 0 && <p className="no-options">ยังไม่มีข้อมูลสำหรับเลือก</p>}
        </div>
      );
    }

    return (
      <div style={{ padding: '16px' }}>
        <label style={{ display: 'block', marginBottom: '12px' }}>
          <span style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#666' }}>พิมพ์ค้นหา</span>
          <input
            type="text"
            placeholder="ค้นหา..."
            value={filters[activeField] || ''}
            onChange={(e) => handleTextSearch(activeField, e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
            autoFocus
          />
        </label>
      </div>
    );
  };

  return (
    <div className="filter-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="filter-panel">
        <div className="filter-header">
          <button className="filter-back" onClick={() => activeField ? setActiveField(null) : onClose()}>←</button>
          <h2>{activeField ? label : 'Filter'}</h2>
        </div>

        {!activeField ? (
          <div className="filter-list">
            {visibleFields.map(([key, name]) => (
              <button className="filter-field filter-button" key={key} onClick={() => { setActiveField(key); setSearchText(''); }}>
                <span>{name}</span>
                {selected(key).length > 0 && <small>{selected(key).length} รายการที่เลือก</small>}
                {filters[key] && typeof filters[key] === 'string' && !Array.isArray(filters[key]) && <small>"{filters[key]}"</small>}
                <b>›</b>
              </button>
            ))}
            <button className="filter-field filter-button" onClick={() => setShowAdvanced((value) => !value)}>
              <span>{showAdvanced ? 'ซ่อนตัวกรองเพิ่มเติม' : 'ตัวกรองเพิ่มเติม'}</span>
              <b>{showAdvanced ? '−' : '+'}</b>
            </button>
          </div>
        ) : (
          renderFilterContent()
        )}

        <div className="filter-actions">
          <button
            className="clear-filter"
            onClick={() => activeField ? setFilters({ ...filters, [activeField]: undefined }) : setFilters({})}
          >
            Clear
          </button>
          <button className="done-filter" onClick={onClose}>Done</button>
        </div>
      </aside>
    </div>
  );
}
