// งานที่แจ้งเปิดเข้ามาผ่านกลุ่ม LINE แล้วแนบรูปมามากกว่า 1 รูปในครั้งเดียว ระบบไม่เดาเอง
// จะสร้างงานไว้ก่อน (ยังไม่ใส่รูป) แล้วมาโผล่ที่นี่ให้เลือกว่าจะใช้รูปไหน
export default function LinePendingImages({ items, onChoose, onSkip, onClose }) {
  return (
    <div className="modal" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-panel">
        <div className="modal-head">
          <h2>เลือกรูปสำหรับงานที่แจ้งผ่าน LINE</h2>
          <button className="icon-btn" type="button" onClick={onClose}>×</button>
        </div>

        {items.length === 0 ? (
          <p style={{ color: '#718087' }}>ไม่มีงานรอเลือกรูปแล้ว</p>
        ) : (
          items.map((item) => (
            <div key={item.id} style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #eef1ef' }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>
                {item.ticket} — {item.requests?.customer || '-'} ({item.requests?.location || '-'})
                {' · '}{item.field === 'completedImage' ? 'รูปงานเสร็จ' : 'รูปที่แจ้ง'}
              </strong>
              {item.requests?.description && (
                <p style={{ margin: '0 0 10px', color: '#718087', fontSize: '13px' }}>{item.requests.description}</p>
              )}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {item.images.map((img) => (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => onChoose(item.id, img.url)}
                    title="เลือกรูปนี้"
                    style={{ border: '2px solid #e4e9e8', borderRadius: '10px', padding: 0, cursor: 'pointer', overflow: 'hidden', background: 'none' }}
                  >
                    <img src={img.url} alt="รูปที่แนบมาจาก LINE" style={{ width: '120px', height: '120px', objectFit: 'cover', display: 'block' }} />
                  </button>
                ))}
              </div>
              <button type="button" className="secondary-btn" onClick={() => onSkip(item.id)}>ไม่ใส่รูปให้งานนี้</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
