// ธีมที่ผู้ใช้ตั้งเอง (สีแถบซ้าย สีพื้นหลัง รูปพื้นหลัง สีตัวหนังสือ) เก็บในเบราว์เซอร์เครื่องนั้น
// ค่า null = ใช้ค่าเริ่มต้นตาม CSS เดิม
const STORAGE_KEY = 'ui-theme';

export const DEFAULT_THEME = {
  sidebarColor: null,
  sidebarTextColor: null,
  pageColor: null,
  backgroundImage: null,
  textColor: null,
  topbarColor: null,
  panelColor: null,
  primaryButtonColor: null,
  secondaryButtonColor: null,
};

// ค่าที่โชว์ในตัวเลือกสีตอนยังไม่ได้ตั้ง (ตรงกับสีเดิมใน modern-ui.css / styles.css)
export const THEME_FALLBACKS = {
  sidebarColor: '#25265f',
  sidebarTextColor: '#a9cfcc',
  pageColor: '#f5f6fb',
  textColor: '#18242b',
  topbarColor: '#ffffff',
  panelColor: '#ffffff',
  primaryButtonColor: '#5b5ce2',
  secondaryButtonColor: '#ffffff',
};

// สีตัวหนังสือบนปุ่ม: ขาวบนสีเข้ม ดำบนสีอ่อน ผู้ใช้ไม่ต้องตั้งเอง และอ่านออกเสมอ
const readableTextOn = (hex) => {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#18242b' : '#ffffff';
};

export const loadTheme = () => {
  try {
    return { ...DEFAULT_THEME, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_THEME };
  }
};

// คืน false ถ้าบันทึกไม่ได้ (ส่วนใหญ่เพราะรูปพื้นหลังใหญ่เกินพื้นที่ localStorage ~5MB)
export const saveTheme = (theme) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
    return true;
  } catch {
    return false;
  }
};

// สร้าง CSS ทับค่าเดิมเฉพาะส่วนที่ผู้ใช้ตั้งไว้
export const buildThemeCss = (theme) => {
  const rules = [];
  if (theme.textColor) {
    rules.push(`:root { --ink: ${theme.textColor}; --modern-text: ${theme.textColor}; }`);
    rules.push(`body, .main-content, .page-heading h1, .metric strong { color: ${theme.textColor}; }`);
  }
  if (theme.sidebarColor) {
    rules.push(`.sidebar { background: ${theme.sidebarColor} !important; }`);
  }
  if (theme.sidebarTextColor) {
    rules.push(`.sidebar, .sidebar .nav-item, .sidebar .nav-item span, .sidebar .brand-text strong { color: ${theme.sidebarTextColor} !important; }`);
  }
  if (theme.pageColor || theme.backgroundImage) {
    const color = theme.pageColor || THEME_FALLBACKS.pageColor;
    const image = theme.backgroundImage ? `url("${theme.backgroundImage}") center / cover no-repeat fixed, ` : '';
    rules.push(`body { background: ${image}${color} !important; }`);
  }
  // แถบด้านบนกับกล่องตัวกรองเดิมเป็นสีขาวโปร่งแสง วางบนพื้นหลังสีเข้มแล้วกลายเป็นสีเทา
  // ตั้งสีแล้วให้เป็นสีทึบตามที่เลือก
  if (theme.topbarColor) {
    rules.push(`.topbar { background: ${theme.topbarColor} !important; backdrop-filter: none !important; }`);
  }
  if (theme.panelColor) {
    rules.push(`.ui-toolbar, .metric, .table-wrap, .detail-card, .requests-split-detail { background: ${theme.panelColor} !important; backdrop-filter: none !important; }`);
    // แถบหัวกลุ่มสถานะ/หัวคอลัมน์ในตาราง: ใช้สีเทาโปร่งทับสีกล่อง ให้ต่างจากแถวข้อมูลนิดหน่อย
    // ไม่งั้นแถบยังเป็นสีอ่อนเดิม แล้วตัวหนังสือสีอ่อนที่ตั้งไว้จะมองไม่เห็น
    rules.push(':root { --table-group-bg: rgba(128, 128, 128, 0.18); --table-head-bg: rgba(128, 128, 128, 0.1); --table-head-text: inherit; }');
  }
  if (theme.primaryButtonColor) {
    rules.push(`.primary-btn { background: ${theme.primaryButtonColor} !important; color: ${readableTextOn(theme.primaryButtonColor)} !important; box-shadow: none !important; }`);
  }
  if (theme.secondaryButtonColor) {
    rules.push(`.secondary-btn { background: ${theme.secondaryButtonColor} !important; color: ${readableTextOn(theme.secondaryButtonColor)} !important; }`);
  }
  return rules.join('\n');
};

// ย่อรูปก่อนเก็บ เพราะ localStorage จุได้ราว 5MB และรูปจากมือถือมักใหญ่หลาย MB
export const resizeImageToDataUrl = (file, maxSize = 1920) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error('อ่านไฟล์ไม่ได้'));
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => reject(new Error('ไฟล์นี้ไม่ใช่รูปภาพ'));
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});
