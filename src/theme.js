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
  borderColor: null,
  fontScale: null, // ตัวเลข % เช่น 120, null = 100
  tableHeadTextColor: null,
  inputColor: null,
  panelOpacity: null, // % ความทึบของกล่องเนื้อหา null = 100 (ทึบ)
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
  borderColor: '#e4e9e8',
  tableHeadTextColor: '#59627a',
  inputColor: '#ffffff',
};

// ช่องที่เป็น "พื้น" เลือกได้ทั้งสีเดียว ("#rrggbb") หรือไล่สี ({ from, to, angle })
// ส่วนสีตัวหนังสือเป็นสีเดียวเสมอ
export const FILL_FIELDS = ['sidebarColor', 'topbarColor', 'pageColor', 'panelColor', 'primaryButtonColor', 'secondaryButtonColor', 'inputColor'];

export const GRADIENT_DIRECTIONS = [
  { angle: 90, label: 'ซ้าย → ขวา' },
  { angle: 180, label: 'บน → ล่าง' },
  { angle: 135, label: 'เฉียง ↘' },
  { angle: 45, label: 'เฉียง ↗' },
];

export const isGradient = (value) => Boolean(value && typeof value === 'object');

// mix = สีแรกเด่นกี่ % (จุดกึ่งกลางการผสม 2 สี) ไม่ได้ตั้ง = 50 เท่ากับไล่สีปกติ
export const gradientMix = (value) => (typeof value?.mix === 'number' ? value.mix : 50);

export const toCssFill = (value) => (isGradient(value)
  ? `linear-gradient(${value.angle}deg, ${value.from}, ${gradientMix(value)}%, ${value.to})`
  : value);

// ใส่ความโปร่งใสให้สี (ทั้งสีเดียวและไล่สี) เช่น #ffffff + 0.6 -> rgba(255, 255, 255, 0.6)
const hexToRgba = (hex, alpha) => {
  const value = String(hex).replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
const withAlpha = (fill, alpha) => {
  if (alpha >= 1) return fill;
  return isGradient(fill)
    ? { ...fill, from: hexToRgba(fill.from, alpha), to: hexToRgba(fill.to, alpha) }
    : hexToRgba(fill, alpha);
};

export const luminanceOf = (hex) => {
  const value = String(hex).replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

// สีตัวหนังสือบนปุ่ม: ขาวบนสีเข้ม ดำบนสีอ่อน (ไล่สีใช้ค่าเฉลี่ยของ 2 สี) ผู้ใช้ไม่ต้องตั้งเอง และอ่านออกเสมอ
const readableTextOn = (fill) => {
  const weight = isGradient(fill) ? gradientMix(fill) / 100 : 1;
  const luminance = isGradient(fill)
    ? luminanceOf(fill.from) * weight + luminanceOf(fill.to) * (1 - weight)
    : luminanceOf(fill);
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
    // หัวคอลัมน์ตารางเดิมเป็นสีเทาตายตัว บนพื้นเข้มมองไม่เห็น ให้ตามสีตัวหนังสือไปด้วย
    rules.push(`:root { --table-head-text: ${theme.textColor}; }`);
  }
  if (theme.textColor) {
    // ป้ายบนการ์ดสรุป ("งานทั้งหมดในหน้านี้" ฯลฯ) เดิมเป็นสีเทาจาง ให้ตามสีตัวหนังสือแบบจางลงนิดหน่อย
    rules.push(`.metric label { color: ${theme.textColor} !important; opacity: 0.8; }`);
  }
  if (theme.inputColor) {
    // ช่องค้นหา ช่องเดือน ช่องสถานะ (สีขาวตั้งไว้ในโค้ดตรงๆ) ตัวหนังสือในช่องตัดกับพื้นช่องเสมอ
    const inputText = readableTextOn(theme.inputColor);
    rules.push(`.search-box, .ui-toolbar select { background: ${toCssFill(theme.inputColor)} !important; }`);
    rules.push(`.search-box input, .ui-toolbar select, .search-box input::placeholder { color: ${inputText} !important; }`);
    rules.push(`.ui-toolbar select option { color: #18242b; background: #fff; }`);
    if (inputText === '#ffffff') rules.push('.search-box input[type="month"] { color-scheme: dark; }');
  }
  if (theme.tableHeadTextColor) {
    rules.push(`:root { --table-head-text: ${theme.tableHeadTextColor}; }`);
  }
  if (theme.sidebarColor) {
    rules.push(`.sidebar { background: ${toCssFill(theme.sidebarColor)} !important; }`);
  }
  if (theme.sidebarTextColor) {
    rules.push(`.sidebar, .sidebar .nav-item, .sidebar .nav-item span, .sidebar .brand-text strong { color: ${theme.sidebarTextColor} !important; }`);
  }
  if (theme.pageColor || theme.backgroundImage) {
    const fill = toCssFill(theme.pageColor || THEME_FALLBACKS.pageColor);
    const image = theme.backgroundImage ? `url("${theme.backgroundImage}") center / cover no-repeat, ` : '';
    // fixed: ไล่สีกับรูปยึดตามหน้าจอ ไม่ยืดตามความยาวทั้งหน้า (ตารางยาวมาก ไล่สีจะจางจนแทบไม่เห็น)
    rules.push(`body { background: ${image}${fill} !important; background-attachment: fixed !important; }`);
  }
  // แถบด้านบนกับกล่องตัวกรองเดิมเป็นสีขาวโปร่งแสง วางบนพื้นหลังสีเข้มแล้วกลายเป็นสีเทา
  // ตั้งสีแล้วให้เป็นสีทึบตามที่เลือก
  if (theme.topbarColor) {
    rules.push(`.topbar { background: ${toCssFill(theme.topbarColor)} !important; backdrop-filter: none !important; }`);
  }
  const panelOpacity = theme.panelOpacity && theme.panelOpacity < 100 ? theme.panelOpacity / 100 : 1;
  if (theme.panelColor || panelOpacity < 1) {
    const fill = withAlpha(theme.panelColor || THEME_FALLBACKS.panelColor, panelOpacity);
    rules.push(`.ui-toolbar, .metric, .table-wrap, .detail-card, .requests-split-detail { background: ${toCssFill(fill)} !important; backdrop-filter: none !important; }`);
    // แถบหัวกลุ่มสถานะ/หัวคอลัมน์ในตาราง: ใช้สีเทาโปร่งทับสีกล่อง ให้ต่างจากแถวข้อมูลนิดหน่อย
    // ไม่งั้นแถบยังเป็นสีอ่อนเดิม แล้วตัวหนังสือสีอ่อนที่ตั้งไว้จะมองไม่เห็น
    rules.push(':root { --table-group-bg: rgba(128, 128, 128, 0.18); --table-head-bg: rgba(128, 128, 128, 0.1); }');
  }
  if (theme.primaryButtonColor) {
    rules.push(`.primary-btn { background: ${toCssFill(theme.primaryButtonColor)} !important; color: ${readableTextOn(theme.primaryButtonColor)} !important; box-shadow: none !important; }`);
  }
  if (theme.secondaryButtonColor) {
    rules.push(`.secondary-btn { background: ${toCssFill(theme.secondaryButtonColor)} !important; color: ${readableTextOn(theme.secondaryButtonColor)} !important; }`);
  } else if (theme.textColor) {
    // ปุ่มรองยังเป็นพื้นขาวเดิม แต่ตัวหนังสือในปุ่มใช้สีตัวหนังสือที่ตั้งไว้ (var(--ink))
    // ถ้าตั้งตัวหนังสือสีขาว ปุ่มจะว่างเปล่า จึงต้องให้ตัวหนังสือในปุ่มตัดกับพื้นปุ่มเสมอ
    rules.push(`.secondary-btn { color: ${readableTextOn(THEME_FALLBACKS.secondaryButtonColor)} !important; }`);
  }
  if (theme.borderColor) {
    rules.push(`:root { --line-color: ${theme.borderColor}; }`);
    rules.push(`.metric, .ui-toolbar, .table-wrap, .ui-card, .detail-card, .requests-split-detail, .secondary-btn, .daily-sheet-card { border-color: ${theme.borderColor} !important; }`);
    rules.push(`.sheet-date, .sheet-label, .sheet-value, .sheet-number, .sheet-child, .sheet-child-value, .detail-status, .detail-section-title { border-color: ${theme.borderColor} !important; }`);
  }
  if (theme.fontScale && theme.fontScale !== 100) {
    // ขนาดตัวหนังสือในเว็บกำหนดเป็น px ตายตัวหลายร้อยจุด จึงขยายทั้งส่วนเนื้อหาด้วย zoom แทน
    // (ไม่รวมแถบเมนู แถบบน และหน้าต่าง popup ซึ่งอยู่นอกส่วนนี้)
    rules.push(`.requests-split, .dashboard-page, .editor-shell { zoom: ${theme.fontScale / 100}; }`);
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
