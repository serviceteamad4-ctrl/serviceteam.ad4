// SSE hub: หน้าจอที่เปิดทิ้งไว้ (รายการงาน/dashboard) จะได้อัปเดตเองทันทีเมื่อข้อมูลเปลี่ยน
// จากฝั่ง LINE webhook หรือเบราว์เซอร์อื่น โดยไม่ต้องกดรีเฟรช
const clients = new Set();

export const addEventsClient = (res) => {
  clients.add(res);
  res.on('close', () => clients.delete(res));
};

export const broadcastRequestsChanged = () => {
  const payload = 'event: requests-changed\ndata: {}\n\n';
  for (const res of clients) res.write(payload);
};

// ปิงทุก 25 วินาทีกัน proxy/load balancer ตัดการเชื่อมต่อที่เงียบนาน
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 25_000);
