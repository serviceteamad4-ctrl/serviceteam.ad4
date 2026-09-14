import { useState } from 'react';

export default function EditableDropdown({ name, label, value, options = [], onChange, onAddOption, onRemoveOption, required = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showDeleteMode, setShowDeleteMode] = useState(false);

  const handleSelect = (option) => {
    onChange({ target: { name, value: option } });
    setIsOpen(false);
    setInputValue('');
  };

  const handleAddNew = () => {
    const newValue = inputValue.trim();
    if (newValue && !options.includes(newValue)) {
      onAddOption(newValue);
      handleSelect(newValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNew();
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
      setShowDeleteMode(false);
    }
  };

  // ตัดช่องว่างซ้ำ/ช่องว่างแบบพิเศษ (เช่น non-breaking space จากไฟล์ Excel) ออกก่อนเทียบ
  // เพื่อให้พิมพ์คำค้นบางส่วน เช่น "bangna" แล้วเจอ "Central   Bangna" ได้แม้มีช่องว่างเกิน
  const normalize = (text) => String(text || '').replace(new RegExp(String.fromCharCode(160), 'g'), ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const normalizedInput = normalize(inputValue);
  const filteredOptions = options.filter((opt) => normalize(opt).includes(normalizedInput));

  return (
    <label className="editor-field">
      <span>{label}{required && <em>*</em>}</span>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <input
            type="text"
            value={isOpen ? inputValue : value}
            onChange={(e) => {
              if (isOpen) {
                setInputValue(e.target.value);
              }
            }}
            onClick={() => setIsOpen(true)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={isOpen ? 'ค้นหาหรือพิมพ์ค่าใหม่...' : 'เลือก...'}
            style={{ flex: 1 }}
          />
          {isOpen && (
            <button
              type="button"
              onClick={() => setShowDeleteMode(!showDeleteMode)}
              title={showDeleteMode ? 'ปิดโหมดลบ' : 'เปิดโหมดลบ'}
              style={{
                padding: '8px 12px',
                background: showDeleteMode ? '#ef765e' : '#f0f0f0',
                color: showDeleteMode ? '#fff' : '#333',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              🗑️
            </button>
          )}
        </div>

        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: '6px',
              maxHeight: '250px',
              overflowY: 'auto',
              zIndex: 100,
              marginTop: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            // กล่องนี้อยู่ใน <label> ที่ครอบ input พอกด "click" ของ label เอง (bubble ขึ้นมาจากตัวเลือกที่กด)
            // จะสั่งโฟกัส input กลับตามพฤติกรรม native ของ label ทำให้ onFocus สั่ง setIsOpen(true) ซ้อนทับ
            // handleSelect ที่เพิ่งสั่งปิดไป ค่าที่เลือกเลยไม่ขึ้นจนกว่าจะเอาเมาส์ออก (ซึ่งไปสั่งปิดซ้ำอีกที)
            // ป้องกันด้วย preventDefault ตอน click เพื่อไม่ให้ label โฟกัส input กลับ
            onClick={(e) => e.preventDefault()}
            onMouseLeave={() => !showDeleteMode && setIsOpen(false)}
          >
            {showDeleteMode ? (
              <div style={{ padding: '8px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  คลิกเพื่อลบรายการ
                </div>
                {options.length === 0 ? (
                  <div style={{ padding: '8px', color: '#999' }}>ไม่มีรายการ</div>
                ) : (
                  options.map((option) => (
                    <div
                      key={option}
                      onClick={() => {
                        onRemoveOption(option);
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: '#fff',
                        borderBottom: '1px solid #eee',
                        color: '#dc5b56',
                        fontSize: '14px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#ffe0de';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fff';
                      }}
                    >
                      ✕ {option}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <>
                {inputValue && !options.includes(inputValue) && (
                  <div
                    onClick={handleAddNew}
                    style={{
                      padding: '10px 12px',
                      background: '#5b5ce2',
                      color: '#fff',
                      cursor: 'pointer',
                      fontWeight: 500,
                      borderBottom: '1px solid #ddd',
                    }}
                  >
                    + เพิ่ม "{inputValue}"
                  </div>
                )}
                {filteredOptions.length === 0 ? (
                  <div style={{ padding: '8px', color: '#999' }}>ไม่พบรายการ</div>
                ) : (
                  filteredOptions.map((option) => (
                    <div
                      key={option}
                      onClick={() => handleSelect(option)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        background: value === option ? '#f0f0ff' : '#fff',
                        borderBottom: '1px solid #eee',
                        color: '#333',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f9f9f9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = value === option ? '#f0f0ff' : '#fff';
                      }}
                    >
                      {option}
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )}
      </div>
    </label>
  );
}
