import { useState } from 'react';
import { DEFAULT_THEME, THEME_FALLBACKS, resizeImageToDataUrl } from './theme.js';

const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 0', borderBottom: '1px solid #eef1ef' };
const labelStyle = { fontSize: '14px', color: '#18242b' };
const resetStyle = { border: 'none', background: 'none', color: '#718087', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' };

function ColorRow({ label, field, theme, onChange }) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {theme[field] && <button type="button" style={resetStyle} onClick={() => onChange({ [field]: null })}>ค่าเริ่มต้น</button>}
        <input
          type="color"
          value={theme[field] || THEME_FALLBACKS[field]}
          onChange={(event) => onChange({ [field]: event.target.value })}
          style={{ width: '48px', height: '36px', padding: '2px', border: '1px solid #dfe6e4', borderRadius: '8px', cursor: 'pointer', background: '#fff' }}
        />
      </div>
    </div>
  );
}

// ตั้งค่าหน้าตา: เปลี่ยนแล้วเห็นผลทันทีและจำไว้ในเบราว์เซอร์เครื่องนี้
export default function SettingsPanel({ theme, onChange, onClose }) {
  const [imageError, setImageError] = useState('');

  const handleImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageError('');
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      if (!onChange({ backgroundImage: dataUrl })) {
        setImageError('รูปใหญ่เกินไป บันทึกไม่ได้ ลองใช้รูปที่เล็กลง');
      }
    } catch (error) {
      setImageError(error.message);
    }
  };

  return (
    <div className="modal" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-panel" style={{ maxWidth: '520px' }}>
        <div className="modal-head">
          <h2 style={{ color: '#18242b' }}>⚙ ตั้งค่าหน้าตา</h2>
          <button className="icon-btn" type="button" onClick={onClose}>×</button>
        </div>

        <h3 style={{ margin: '4px 0 0', fontSize: '13px', color: '#087f75' }}>แถบเมนูซ้าย</h3>
        <ColorRow label="สีแถบเมนูซ้าย" field="sidebarColor" theme={theme} onChange={onChange} />
        <ColorRow label="สีตัวหนังสือแถบเมนูซ้าย" field="sidebarTextColor" theme={theme} onChange={onChange} />

        <h3 style={{ margin: '18px 0 0', fontSize: '13px', color: '#087f75' }}>แถบด้านบน</h3>
        <ColorRow label="สีแถบด้านบน" field="topbarColor" theme={theme} onChange={onChange} />

        <h3 style={{ margin: '18px 0 0', fontSize: '13px', color: '#087f75' }}>หน้าใช้งาน</h3>
        <ColorRow label="สีพื้นหลัง" field="pageColor" theme={theme} onChange={onChange} />
        <ColorRow label="สีกล่องเนื้อหา (ตัวกรอง การ์ด ตาราง)" field="panelColor" theme={theme} onChange={onChange} />
        <div style={rowStyle}>
          <span style={labelStyle}>รูปพื้นหลัง</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {theme.backgroundImage && (
              <>
                <img src={theme.backgroundImage} alt="" style={{ width: '64px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #dfe6e4' }} />
                <button type="button" style={resetStyle} onClick={() => onChange({ backgroundImage: null })}>ลบรูป</button>
              </>
            )}
            <label className="secondary-btn" style={{ cursor: 'pointer', display: 'inline-block', fontSize: '13px', color: '#18242b' }}>
              {theme.backgroundImage ? 'เปลี่ยนรูป' : 'เลือกรูป'}
              <input type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
        {imageError && <p style={{ color: '#c0392b', fontSize: '13px', margin: '6px 0 0' }}>{imageError}</p>}
        <ColorRow label="สีตัวหนังสือ" field="textColor" theme={theme} onChange={onChange} />

        <h3 style={{ margin: '18px 0 0', fontSize: '13px', color: '#087f75' }}>ปุ่มกด</h3>
        <ColorRow label="สีปุ่มหลัก (เพิ่มงานใหม่ บันทึก)" field="primaryButtonColor" theme={theme} onChange={onChange} />
        <ColorRow label="สีปุ่มรอง (ตัวกรอง แก้ไข ดาวน์โหลด)" field="secondaryButtonColor" theme={theme} onChange={onChange} />

        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="secondary-btn" onClick={() => onChange({ ...DEFAULT_THEME })}>คืนค่าเริ่มต้นทั้งหมด</button>
          <button type="button" className="primary-btn" onClick={onClose}>เสร็จ</button>
        </div>
      </div>
    </div>
  );
}
