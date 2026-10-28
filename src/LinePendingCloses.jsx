import { useState } from 'react';

const formatThaiDateTime = (value) => (value
  ? new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value))
  : '-');

function TicketInput({ onSubmit }) {
  const [ticket, setTicket] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!ticket.trim() || busy) return;
    setBusy(true);
    setError('');
    const message = await onSubmit(ticket.trim());
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          value={ticket}
          onChange={(event) => setTicket(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
          placeholder="หรือใส่เลขงาน เช่น TRU005886 / 005886"
          style={{ flex: 1, height: '38px', border: '1px solid #dfe6e4', borderRadius: '8px', padding: '0 10px', color: '#18242b' }}
        />
        <button type="button" className="secondary-btn" onClick={submit} disabled={busy}>ปิดงานเลขนี้</button>
      </div>
      {error && <div style={{ color: '#c0392b', fontSize: '12px', marginTop: '4px' }}>{error}</div>}
    </div>
  );
}

// "แจ้งปิดงาน" จาก LINE ที่ระบบไม่แน่ใจว่าเป็นงานไหน:
// - ลูกค้า+สถานที่ตรงกับงานค้างหลายงาน หรือ
// - เขียนแบบอิสระไม่มีเลขงาน (fuzzy) ระบบเดางานที่ใกล้เคียงให้ คนต้องยืนยันว่าถูกไหม
export default function LinePendingCloses({ items, onChoose, onChooseTicket, onDismiss, onClose }) {
  return (
    <div className="modal" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-panel">
        <div className="modal-head">
          <h2>ยืนยันงานที่จะปิดจาก LINE</h2>
          <button className="icon-btn" type="button" onClick={onClose}>×</button>
        </div>

        {items.length === 0 ? (
          <p style={{ color: '#718087' }}>ไม่มีงานรอยืนยันแล้ว</p>
        ) : (
          items.map((item) => {
            const fuzzy = Boolean(item.fields?.fuzzy);
            const title = item.fields?.jobName || [item.fields?.customer, item.fields?.location].filter(Boolean).join(' / ') || 'ไม่ระบุชื่องาน';
            return (
              <div key={item.id} style={{ minWidth: 0, marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #eef1ef' }}>
                {fuzzy && (
                  <div style={{ background: '#fff4e5', border: '1px solid #f0a43a', color: '#9a5a00', borderRadius: '10px', padding: '8px 12px', marginBottom: '10px', fontSize: '13px' }}>
                    ⚠️ มีคนแจ้งปิดงานมาใน LINE แต่ไม่ตรงแพทเทิร์น — ระบบยังไม่ได้ปิดงานไหน กรุณาตรวจสอบว่างานที่ระบบเดาให้ถูกไหม
                  </div>
                )}
                <strong style={{ display: 'block', marginBottom: '4px' }}>
                  {title} · แจ้งปิดเมื่อ {formatThaiDateTime(item.completed_at)}
                </strong>
                <p style={{ margin: '0 0 10px', color: '#718087', fontSize: '13px' }}>
                  ผู้ดำเนินการ: {item.fields?.assignee || '-'}
                  {item.fields?.jobType && ` · ลักษณะงาน: ${item.fields.jobType}`}
                  {item.images?.length > 0 && ` · รูปงานเสร็จ ${item.images.length} รูป`}
                </p>

                {fuzzy && item.fields?.rawText && (
                  <details style={{ marginBottom: '10px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '13px', color: '#087f75' }}>ดูข้อความที่ส่งมาใน LINE</summary>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '13px', background: '#f7f8f8', border: '1px solid #eef1ef', borderRadius: '8px', padding: '10px', margin: '6px 0 0' }}>
                      {item.fields.rawText}
                    </pre>
                  </details>
                )}

                <p style={{ margin: '0 0 8px', fontSize: '13px' }}>
                  {fuzzy
                    ? (item.candidates.length > 0
                      ? 'ข้อความนี้ไม่มีเลขงาน ระบบเดางานที่ใกล้เคียงให้ — งานที่ถูกคืองานไหน?'
                      : 'ข้อความนี้ไม่มีเลขงาน และระบบหางานที่ใกล้เคียงไม่เจอ ใส่เลขงานด้านล่างเพื่อปิด')
                    : `มีงานค้างตรงกัน ${item.candidates.length} งาน เลือกงานที่จะปิด:`}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px', marginBottom: '10px' }}>
                  {item.candidates.map((job, index) => (
                    <div
                      key={job.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, padding: '10px 12px', borderRadius: '10px',
                        border: fuzzy && index === 0 ? '2px solid #087f75' : '1px solid #e4e9e8',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {fuzzy && index === 0 && (
                          <span style={{ fontSize: '11px', background: '#e3f3ef', color: '#087f75', borderRadius: '999px', padding: '1px 8px', marginRight: '6px' }}>น่าจะใช่</span>
                        )}
                        <strong>{job.ticket}</strong>
                        <span style={{ color: '#718087', fontSize: '12px' }}> · {job.customer} · {job.location || '-'} · {job.status} · แจ้งเมื่อ {formatThaiDateTime(job.receivedAt)}</span>
                        {job.description && <div style={{ color: '#59627a', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.description}</div>}
                      </div>
                      <button type="button" className="primary-btn" onClick={() => onChoose(item.id, job.id)}>
                        {fuzzy ? 'ใช่ ปิดงานนี้' : 'ปิดงานนี้'}
                      </button>
                    </div>
                  ))}
                </div>
                <TicketInput onSubmit={(ticket) => onChooseTicket(item.id, ticket)} />
                <button type="button" className="secondary-btn" onClick={() => onDismiss(item.id)}>ไม่ปิดงานไหน (แจ้งผิด)</button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
