import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDate, isViewableImageUrl } from './requestUtils.js';

// จัดกลุ่มฟิลด์เป็นหมวดหมู่ให้อ่านง่ายขึ้น แทนการแสดงเรียงยาวทีละรายการ
const sections = [
  {
    title: 'ข้อมูลลูกค้า',
    fields: [
      ['customer', 'ลูกค้า'], ['ref', 'Ref.'], ['source', 'แหล่งที่มา'],
      ['receivedAt', 'วันเวลาที่รับแจ้ง'], ['ticket', 'เลขที่ติดตามงาน'],
      ['location', 'สถานที่/สาขา'], ['site', 'สถานที่ตั้ง'],
      ['contact', 'ผู้ติดต่อ'], ['phone', 'เบอร์ติดต่อ'],
    ],
  },
  {
    title: 'รายละเอียดการแจ้งงาน',
    fields: [
      ['description', 'ข้อมูลการรับแจ้ง'], ['image', 'รูปภาพที่แจ้ง'],
      ['ma', 'MA'], ['jobType', 'ลักษณะงาน'], ['status', 'สถานะงาน'],
      ['assignee', 'ผู้ดำเนินการ'],
      ['appointment', 'วันนัดหมาย เวลาเริ่มต้น'], ['appointmentEnd', 'วันนัดหมาย เวลาสิ้นสุด'],
    ],
  },
  {
    title: 'ผลการดำเนินการ',
    fields: [
      ['action', 'รายละเอียดการดำเนินการ'], ['result', 'ผลการดำเนินการ'],
      ['equipment', 'เกี่ยวกับอุปกรณ์'], ['completedImage', 'รูปภาพที่ดำเนินการเสร็จแล้ว'],
      ['completedAt', 'วันเวลาเสร็จ'], ['map', 'MAP'], ['vehicle', 'ทะเบียนรถ'],
      ['notes', 'หมายเหตุ'], ['file', 'ไฟล์'],
    ],
  },
];

const IMAGE_KEYS = ['image', 'completedImage'];
const WIDE_KEYS = ['description', 'action', 'result', 'notes', 'image', 'completedImage'];
const DATE_KEYS = ['receivedAt', 'appointment', 'appointmentEnd', 'completedAt'];

// รองรับทั้งรูปแบบเก่า (data:image base64) และรูปแบบใหม่ (URL จาก Supabase Storage / เก็บบนเซิร์ฟเวอร์)
const isImageValue = (key, value) => IMAGE_KEYS.includes(key) && typeof value === 'string' && value.trim().length > 0;
const isMissingImageValue = (key, value) => IMAGE_KEYS.includes(key) && typeof value === 'string' && value.trim().length > 0 && !isViewableImageUrl(value);

export default function RequestDetail({ request, onBack, onEdit, onDelete, embedded = false }) {
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    if (!lightboxImage) return undefined;
    const closeOnEscape = (event) => event.key === 'Escape' && setLightboxImage(null);
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [lightboxImage]);

  return (
    <section className={embedded ? 'detail-embedded' : 'detail-page view active-view'}>
      <div className="detail-header">
        {!embedded && <button className="detail-back" onClick={onBack}>←</button>}
        <div>
          {!embedded && <p className="eyebrow">SERVICE REQUEST / DETAIL</p>}
          <h1>{request.ticket || request.ref || 'รายละเอียดงาน'}</h1>
          {!embedded && <p className="subheading">รายละเอียดข้อมูลการแจ้งบริการ</p>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {embedded && <button className="secondary-btn" type="button" onClick={onBack}>ปิด</button>}
          <button className="secondary-btn" type="button" onClick={() => onDelete && onDelete(request.id)}>ลบ</button>
          <button className="primary-btn" onClick={() => onEdit(request)}>แก้ไขงาน</button>
        </div>
      </div>

      <div className="detail-card">
        <div className="detail-status">
          <span className="status">{request.status || '-'}</span>
          {request.ref ? <span className="level p2">{request.ref}</span> : null}
        </div>

        {sections.map((section) => {
          const visibleFields = section.fields.filter(([key]) => request[key]);
          if (visibleFields.length === 0) return null;

          return (
            <div className="detail-section" key={section.title}>
              <h3 className="detail-section-title">{section.title}</h3>
              <div className="detail-grid">
                {visibleFields.map(([key, label]) => {
                  const value = request[key];
                  return (
                    <div className={`detail-field ${WIDE_KEYS.includes(key) ? 'detail-wide' : ''}`} key={key}>
                      <span>{label}</span>
                      {isImageValue(key, value) && isViewableImageUrl(value) ? (
                        <button type="button" className="image-zoom-trigger" onClick={() => setLightboxImage(value)}>
                          <img src={value} alt={label} />
                        </button>
                      ) : isMissingImageValue(key, value) ? (
                        <em className="image-unavailable">ไม่มีไฟล์รูปภาพ (ข้อมูลนำเข้าเก่า หารูปต้นฉบับไม่พบ)</em>
                      ) : (
                        <strong>{DATE_KEYS.includes(key) ? formatDate(value) : value}</strong>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ใช้ portal ไปไว้ที่ body: แผงรายละเอียดด้านขวามี transform (animation เลื่อนเข้า) ทำให้
          position: fixed ของลูกถูกขังอยู่ในกรอบแผง รูปเลยไม่ขึ้นกลางจอและปุ่มปิดถูกตัดหาย */}
      {lightboxImage && createPortal(
        <div
          className="modal"
          onClick={(event) => event.target === event.currentTarget && setLightboxImage(null)}
          style={{ background: 'rgba(10, 14, 30, 0.82)', zIndex: 1000 }}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            aria-label="ปิดรูป"
            title="ปิด (Esc)"
            style={{
              position: 'fixed', top: '18px', right: '18px', width: '44px', height: '44px',
              borderRadius: '50%', border: 'none', background: '#fff', color: '#18242b',
              fontSize: '26px', lineHeight: 1, cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
            }}
          >
            ×
          </button>
          <img
            src={lightboxImage}
            alt="ภาพขยาย"
            style={{ display: 'block', maxWidth: '90vw', maxHeight: '88vh', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
          />
        </div>,
        document.body,
      )}
    </section>
  );
}
