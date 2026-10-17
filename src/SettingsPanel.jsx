import { useState } from 'react';
import {
  DEFAULT_THEME, THEME_FALLBACKS, THEME_PRESETS, presetPreview, GRADIENT_DIRECTIONS, isGradient, toCssFill, gradientMix,
  luminanceOf, resizeImageToDataUrl,
} from './theme.js';

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

const colorInputStyle = { width: '40px', height: '32px', padding: '2px', border: '1px solid #dfe6e4', borderRadius: '8px', cursor: 'pointer', background: '#fff' };
const modeButtonStyle = (active) => ({
  padding: '4px 10px', fontSize: '12px', cursor: 'pointer', border: '1px solid #dfe6e4',
  background: active ? '#18242b' : '#fff', color: active ? '#fff' : '#18242b',
});

// ช่องพื้น: เลือกได้ "สีเดียว" หรือ "ไล่สี" (2 สี + ทิศทาง) พร้อมตัวอย่าง
function FillRow({ label, field, theme, onChange }) {
  const value = theme[field];
  const gradient = isGradient(value);
  const solid = gradient ? value.from : (value || THEME_FALLBACKS[field]);

  const toGradient = () => onChange({
    // สีที่ 2 เริ่มต้น: ตัดกับสีแรก จะได้เห็นการไล่สีชัดตั้งแต่กดครั้งแรก
    [field]: { from: solid, to: luminanceOf(solid) > 0.5 ? '#3a3f9e' : '#9fd3ff', angle: 135, mix: 50 },
  });
  const toSolid = () => onChange({ [field]: gradient ? value.from : solid });
  const setPart = (part, partValue) => onChange({ [field]: { ...value, [part]: partValue } });

  return (
    <div style={{ ...rowStyle, flexWrap: 'wrap' }}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {value && <button type="button" style={resetStyle} onClick={() => onChange({ [field]: null })}>ค่าเริ่มต้น</button>}
        <div style={{ display: 'inline-flex', borderRadius: '8px', overflow: 'hidden' }}>
          <button type="button" style={{ ...modeButtonStyle(!gradient), borderRadius: '8px 0 0 8px' }} onClick={toSolid}>สีเดียว</button>
          <button type="button" style={{ ...modeButtonStyle(gradient), borderRadius: '0 8px 8px 0', borderLeft: 'none' }} onClick={toGradient}>ไล่สี</button>
        </div>
        {gradient ? (
          <>
            <input type="color" title="สีเริ่ม" value={value.from} onChange={(event) => setPart('from', event.target.value)} style={colorInputStyle} />
            <input type="color" title="สีปลาย" value={value.to} onChange={(event) => setPart('to', event.target.value)} style={colorInputStyle} />
            <select
              value={value.angle}
              onChange={(event) => setPart('angle', Number(event.target.value))}
              style={{ height: '32px', borderRadius: '8px', border: '1px solid #dfe6e4', padding: '0 6px', color: '#18242b', background: '#fff', fontSize: '12px' }}
            >
              {GRADIENT_DIRECTIONS.map((direction) => <option key={direction.angle} value={direction.angle}>{direction.label}</option>)}
            </select>
            <span title="ตัวอย่าง" style={{ width: '56px', height: '32px', borderRadius: '8px', border: '1px solid #dfe6e4', background: toCssFill(value) }} />
          </>
        ) : (
          <input type="color" value={solid} onChange={(event) => onChange({ [field]: event.target.value })} style={colorInputStyle} />
        )}
      </div>
      {gradient && (
        <div style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: '#718087' }}>สีแรกเด่น</span>
          <input
            type="range"
            min="5"
            max="95"
            step="5"
            value={gradientMix(value)}
            onChange={(event) => setPart('mix', Number(event.target.value))}
            style={{ width: '180px', accentColor: value.from, cursor: 'pointer' }}
          />
          <span style={{ fontSize: '12px', color: '#18242b', minWidth: '36px', textAlign: 'right' }}>{gradientMix(value)}%</span>
        </div>
      )}
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
      <div className="modal-panel" style={{ maxWidth: '560px' }}>
        <div className="modal-head">
          <h2 style={{ color: '#18242b' }}>⚙ ตั้งค่าหน้าตา</h2>
          <button className="icon-btn" type="button" onClick={onClose}>×</button>
        </div>

        <h3 style={{ margin: '4px 0 10px', fontSize: '13px', color: '#087f75' }}>ธีมสำเร็จรูป (กดแล้วปรับต่อด้านล่างได้)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '8px' }}>
          {THEME_PRESETS.map((preset) => {
            const look = presetPreview(preset);
            return (
              <button
                key={preset.name}
                type="button"
                // คงรูปพื้นหลังกับขนาดตัวหนังสือที่ตั้งไว้ เปลี่ยนเฉพาะชุดสี
                onClick={() => onChange({ ...DEFAULT_THEME, backgroundImage: theme.backgroundImage, fontScale: theme.fontScale, ...preset.theme })}
                style={{ padding: 0, border: '1px solid #dfe6e4', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', background: '#fff', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', height: '64px' }}>
                  <div style={{ width: '22%', background: look.sidebar }} />
                  <div style={{ flex: 1, background: look.page, padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ height: '8px', width: '45%', borderRadius: '4px', background: look.button }} />
                    <div style={{ flex: 1, borderRadius: '6px', background: look.panel, opacity: 0.9, borderTop: `3px solid ${look.accent}` }} />
                  </div>
                </div>
                <div style={{ padding: '6px 8px', fontSize: '12px', color: '#18242b' }}>{preset.name}</div>
              </button>
            );
          })}
        </div>
        <ColorRow label="สีเน้น (แถวที่เลือก แถบหัวกลุ่ม หัวข้อ เมนูที่เลือก)" field="accentColor" theme={theme} onChange={onChange} />

        <h3 style={{ margin: '18px 0 0', fontSize: '13px', color: '#087f75' }}>แถบเมนูซ้าย</h3>
        <FillRow label="สีแถบเมนูซ้าย" field="sidebarColor" theme={theme} onChange={onChange} />
        <ColorRow label="สีตัวหนังสือแถบเมนูซ้าย" field="sidebarTextColor" theme={theme} onChange={onChange} />

        <h3 style={{ margin: '18px 0 0', fontSize: '13px', color: '#087f75' }}>แถบด้านบน</h3>
        <FillRow label="สีแถบด้านบน" field="topbarColor" theme={theme} onChange={onChange} />

        <h3 style={{ margin: '18px 0 0', fontSize: '13px', color: '#087f75' }}>หน้าใช้งาน</h3>
        <FillRow label="สีพื้นหลัง" field="pageColor" theme={theme} onChange={onChange} />
        <FillRow label="สีกล่องเนื้อหา (ตัวกรอง การ์ด ตาราง)" field="panelColor" theme={theme} onChange={onChange} />
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
        <div style={rowStyle}>
          <span style={labelStyle}>ขนาดตัวหนังสือ</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {theme.fontScale && theme.fontScale !== 100 && (
              <button type="button" style={resetStyle} onClick={() => onChange({ fontScale: null })}>ค่าเริ่มต้น</button>
            )}
            <input
              type="range"
              min="80"
              max="150"
              step="10"
              value={theme.fontScale || 100}
              onChange={(event) => onChange({ fontScale: Number(event.target.value) })}
              style={{ width: '160px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', color: '#18242b', minWidth: '40px', textAlign: 'right' }}>{theme.fontScale || 100}%</span>
          </div>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>ความทึบของกล่องเนื้อหา</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {theme.panelOpacity && theme.panelOpacity !== 100 && (
              <button type="button" style={resetStyle} onClick={() => onChange({ panelOpacity: null })}>ค่าเริ่มต้น</button>
            )}
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={theme.panelOpacity || 100}
              onChange={(event) => onChange({ panelOpacity: Number(event.target.value) })}
              style={{ width: '160px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', color: '#18242b', minWidth: '40px', textAlign: 'right' }}>{theme.panelOpacity || 100}%</span>
          </div>
        </div>
        <FillRow label="สีช่องกรอก (ค้นหา เดือน สถานะ)" field="inputColor" theme={theme} onChange={onChange} />
        <ColorRow label="สีหัวคอลัมน์ตาราง (ลูกค้า อ้างอิง ...)" field="tableHeadTextColor" theme={theme} onChange={onChange} />
        <ColorRow label="สีเส้นขอบ (กรอบกล่อง เส้นในตาราง)" field="borderColor" theme={theme} onChange={onChange} />

        <h3 style={{ margin: '18px 0 0', fontSize: '13px', color: '#087f75' }}>ปุ่มกด</h3>
        <FillRow label="สีปุ่มหลัก (เพิ่มงานใหม่ บันทึก)" field="primaryButtonColor" theme={theme} onChange={onChange} />
        <FillRow label="สีปุ่มรอง (ตัวกรอง แก้ไข ดาวน์โหลด)" field="secondaryButtonColor" theme={theme} onChange={onChange} />

        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="secondary-btn" onClick={() => onChange({ ...DEFAULT_THEME })}>คืนค่าเริ่มต้นทั้งหมด</button>
          <button type="button" className="primary-btn" onClick={onClose}>เสร็จ</button>
        </div>
      </div>
    </div>
  );
}
