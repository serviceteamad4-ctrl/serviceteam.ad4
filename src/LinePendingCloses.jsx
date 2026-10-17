const formatThaiDateTime = (value) => (value
  ? new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value))
  : '-');

// "แจ้งปิดงาน" จาก LINE ที่ไม่ได้ใส่เลขงาน แต่ลูกค้า+สถานที่ตรงกับงานค้างหลายงาน
// ระบบไม่เดาเอง ให้คนเลือกที่นี่ว่าจะปิดงานไหน
export default function LinePendingCloses({ items, onChoose, onDismiss, onClose }) {
  return (
    <div className="modal" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-panel">
        <div className="modal-head">
          <h2>เลือกงานที่จะปิดจาก LINE</h2>
          <button className="icon-btn" type="button" onClick={onClose}>×</button>
        </div>

        {items.length === 0 ? (
          <p style={{ color: '#718087' }}>ไม่มีงานรอเลือกปิดแล้ว</p>
        ) : (
          items.map((item) => (
            <div key={item.id} style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #eef1ef' }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>
                {item.fields?.customer || '-'} ({item.fields?.location || '-'}) · แจ้งปิดเมื่อ {formatThaiDateTime(item.completed_at)}
              </strong>
              <p style={{ margin: '0 0 10px', color: '#718087', fontSize: '13px' }}>
                ผู้ดำเนินการ: {item.fields?.assignee || '-'} · การดำเนินการ: {item.fields?.action || '-'}
                {item.images?.length > 0 && ` · รูปงานเสร็จ ${item.images.length} รูป`}
              </p>
              <p style={{ margin: '0 0 8px', fontSize: '13px' }}>มีงานค้างตรงกัน {item.candidates.length} งาน เลือกงานที่จะปิด:</p>
              <div style={{ display: 'grid', gap: '8px', marginBottom: '10px' }}>
                {item.candidates.map((job) => (
                  <div key={job.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', border: '1px solid #e4e9e8', borderRadius: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{job.ticket}</strong>
                      <span style={{ color: '#718087', fontSize: '12px' }}> · {job.status} · แจ้งเมื่อ {formatThaiDateTime(job.receivedAt)}</span>
                      {job.description && <div style={{ color: '#59627a', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.description}</div>}
                    </div>
                    <button type="button" className="primary-btn" onClick={() => onChoose(item.id, job.id)}>ปิดงานนี้</button>
                  </div>
                ))}
              </div>
              <button type="button" className="secondary-btn" onClick={() => onDismiss(item.id)}>ไม่ปิดงานไหน (แจ้งผิด)</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
