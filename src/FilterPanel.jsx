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

export const dateFields = ['receivedAt', 'appointment', 'appointmentEnd', 'completedAt'];
const selectOnlyFields = ['ref'];
const dropdownFields = ['status', 'source', 'jobType', 'equipment'];
const refOptions = ['P1', 'P2', 'P3', 'PM'];

const fallbackOptions = {
  source: ['ไลน์', 'โทรศัพท์', 'อีเมล', 'เว็บไซต์'],
  jobType: ['แนะนำ', 'แก้ไขหน้างาน', 'รีโมท', 'ประเมินราคา', 'เทรน'],
  status: ['รับเรื่อง', 'รอดำเนินการ', 'กำลังดำเนินการ', 'รอลูกค้าสรุปงาน', 'รออะไหล่', 'เรียบร้อยปกติ', 'รอเสนอราคา'],
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
    // ฟิลด์ข้อความทั่วไป: ดึงค่าจริงที่เคยกรอกไว้ในข้อมูลมาให้ติ๊กเลือกได้ แทนที่จะพิมพ์ค้นหาอย่างเดียว
    const fromData = requests.map((item) => item[key]).filter(Boolean).map((value) => String(value).trim());
    return [...new Set(fromData)].sort((a, b) => a.localeCompare(b, 'th'));
  };

  const selected = (key) => Array.isArray(filters[key]) ? filters[key] : filters[key] ? [filters[key]] : [];
  const toggle = (key, value) => {
    const current = selected(key);
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    setFilters({ ...filters, [key]: next });
  };

  // ตัวกรองวันที่เป็นแบบช่วง (จากวันที่ - ถึงวันที่) แทนการเทียบวันเวลาให้ตรงเป๊ะ ซึ่งแทบไม่เจอผลลัพธ์เลย
  const handleDateRangeChange = (key, part, value) => {
    const current = filters[key] && typeof filters[key] === 'object' ? filters[key] : {};
    const next = { ...current, [part]: value || undefined };
    setFilters({ ...filters, [key]: (next.from || next.to) ? next : undefined });
  };

  const label = filterFields.find(([key]) => key === activeField)?.[1];
  const visibleFields = showAdvanced ? filterFields : primaryFilterFields;

  const renderFilterContent = () => {
    if (!activeField) return null;

    if (dateFields.includes(activeField)) {
      const range = filters[activeField] && typeof filters[activeField] === 'object' ? filters[activeField] : {};
      const dateInputStyle = {
        width: '100%',
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '6px',
        fontSize: '14px',
        boxSizing: 'border-box',
      };
      return (
        <div style={{ padding: '16px', display: 'grid', gap: '14px' }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#666' }}>ตั้งแต่วันที่</span>
            <input
              type="date"
              value={range.from || ''}
              onChange={(e) => handleDateRangeChange(activeField, 'from', e.target.value)}
              style={dateInputStyle}
            />
          </label>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#666' }}>ถึงวันที่</span>
            <input
              type="date"
              value={range.to || ''}
              onChange={(e) => handleDateRangeChange(activeField, 'to', e.target.value)}
              style={dateInputStyle}
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

    const allOptions = valuesFor(activeField);
    const options = searchText
      ? allOptions.filter((value) => value.toLowerCase().includes(searchText.toLowerCase()))
      : allOptions;

    return (
      <>
        <div style={{ padding: '16px 16px 8px' }}>
          <label style={{ display: 'block' }}>
            <span style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#666' }}>พิมพ์ค้นหา</span>
            <input
              type="text"
              placeholder="ค้นหา..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
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
          {options.length === 0 && (
            <p className="no-options">{allOptions.length === 0 ? 'ยังไม่มีข้อมูลสำหรับเลือก' : 'ไม่พบข้อมูลที่ตรงกับคำค้นหา'}</p>
          )}
        </div>
      </>
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
                {dateFields.includes(key) && filters[key] && (filters[key].from || filters[key].to) && (
                  <small>{filters[key].from || '…'} – {filters[key].to || '…'}</small>
                )}
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
