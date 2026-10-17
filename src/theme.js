// ธีมที่ผู้ใช้ตั้งเอง (สีแถบซ้าย สีพื้นหลัง รูปพื้นหลัง สีตัวหนังสือ) เก็บในเบราว์เซอร์เครื่องนั้น
// ค่า null = ใช้ค่าเริ่มต้นตาม CSS เดิม
const STORAGE_KEY = 'ui-theme';

export const DEFAULT_THEME = {
  sidebarColor: null,
  sidebarTextColor: null,
  pageColor: null,
  backgroundImage: null,
  textColor: null,
};

// ค่าที่โชว์ในตัวเลือกสีตอนยังไม่ได้ตั้ง (ตรงกับสีเดิมใน modern-ui.css / styles.css)
export const THEME_FALLBACKS = {
  sidebarColor: '#25265f',
  sidebarTextColor: '#a9cfcc',
  pageColor: '#f5f6fb',
  textColor: '#18242b',
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
    // แถบด้านบนเดิมเป็นสีขาวโปร่ง ให้โปร่งขึ้นเพื่อเห็นพื้นหลังที่ตั้ง
    rules.push('.topbar { background: rgba(255, 255, 255, 0.55) !important; }');
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
