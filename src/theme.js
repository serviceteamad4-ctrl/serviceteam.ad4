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
  // สีเน้นตัวเดียวคุมจุดที่เดิมเป็นสีตายตัว: แถวที่เลือก แถบหัวกลุ่ม หัวข้อในหน้ารายละเอียด เมนูที่เลือก
  accentColor: null,
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
  accentColor: '#087f75',
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
    rules.push(`.metric label, .detail-field span, .daily-report-head small { color: ${theme.textColor} !important; opacity: 0.75; }`);
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
  if (theme.accentColor) {
    const accent = theme.accentColor;
    // วางหลังกฎของกล่องเนื้อหา เพื่อให้แถบหัวกลุ่ม/หัวคอลัมน์ใช้โทนสีเน้นแทนสีเทา
    rules.push(`:root { --row-selected-bg: ${hexToRgba(accent, 0.3)}; --row-highlight-bg: ${hexToRgba(accent, 0.16)}; --table-group-bg: ${hexToRgba(accent, 0.2)}; --table-head-bg: ${hexToRgba(accent, 0.08)}; --teal: ${accent}; }`);
    rules.push(`.detail-section-title { color: ${accent} !important; }`);
    rules.push(`.sidebar .nav-item.active { background: linear-gradient(90deg, ${hexToRgba(accent, 0.4)}, ${hexToRgba(accent, 0.08)}) !important; box-shadow: inset 3px 0 ${accent} !important; }`);
  }

  // เส้นขอบ: ถ้าผู้ใช้เลือกสีเอง ใช้สีนั้นแบบจางลง (เส้นสีทึบเต็มๆ ดูแข็ง) ถ้าไม่ได้เลือกแต่เปลี่ยนสีกล่อง/พื้นหลังแล้ว
  // ใช้เส้นโปร่งแสงอัตโนมัติ (ขาวจางบนพื้นเข้ม ดำจางบนพื้นอ่อน) แทนเส้นเทาเดิมที่ขัดกับสีที่ตั้ง
  let line = theme.borderColor ? hexToRgba(theme.borderColor, 0.6) : null;
  if (!line && (theme.panelColor || theme.pageColor || panelOpacity < 1)) {
    const panelBase = theme.panelColor || THEME_FALLBACKS.panelColor;
    const lum = isGradient(panelBase) ? (luminanceOf(panelBase.from) + luminanceOf(panelBase.to)) / 2 : luminanceOf(panelBase);
    line = lum < 0.5 ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.08)';
  }
  if (line) {
    rules.push(`:root { --line-color: ${line}; }`);
    rules.push(`.metric, .ui-toolbar, .table-wrap, .ui-card, .detail-card, .requests-split-detail, .secondary-btn, .daily-sheet-card { border-color: ${line} !important; }`);
    rules.push(`.sheet-date, .sheet-label, .sheet-value, .sheet-number, .sheet-child, .sheet-child-value, .detail-status, .detail-section-title { border-color: ${line} !important; }`);
  }
  // แผงตัวกรองด้านขวา: ถ้าตั้งสีกล่องเนื้อหาไว้ ให้แผงใช้สีเดียวกัน (ทึบเสมอ เพราะวางทับรายการงาน)
  // ถ้าไม่ได้ตั้ง แผงยังเป็นสีขาวเดิม + ตัวหนังสือเข้ม (กำหนดไว้ใน modern-ui.css)
  if (theme.panelColor) {
    const panelText = theme.textColor || readableTextOn(theme.panelColor);
    rules.push(`body .filter-panel { background: ${toCssFill(theme.panelColor)}; --ink: ${panelText}; color: ${panelText}; }`);
    rules.push('body .filter-actions { background: transparent; }');
    rules.push(`body .filter-sublabel, body .filter-field b, body .no-options { color: ${panelText} !important; opacity: 0.7; }`);
    rules.push(`body .filter-field:hover, body .check-option:hover { background: ${hexToRgba(theme.accentColor || THEME_FALLBACKS.accentColor, 0.15)}; }`);
  }
  if (line) {
    rules.push(`body .filter-header, body .filter-field, body .filter-actions { border-color: ${line} !important; }`);
  }
  if (theme.inputColor) {
    rules.push(`body .filter-input { background: ${toCssFill(theme.inputColor)} !important; color: ${readableTextOn(theme.inputColor)} !important; border-color: ${line || '#ddd'} !important; }`);
    if (readableTextOn(theme.inputColor) === '#ffffff') rules.push('body .filter-input { color-scheme: dark; }');
  }
  if (theme.accentColor) {
    rules.push(`body .done-filter { color: ${theme.accentColor}; } body .check-option input { accent-color: ${theme.accentColor}; }`);
  }

  if (theme.fontScale && theme.fontScale !== 100) {
    // ขนาดตัวหนังสือในเว็บกำหนดเป็น px ตายตัวหลายร้อยจุด จึงขยายทั้งส่วนเนื้อหาด้วย zoom แทน
    // (ไม่รวมแถบเมนู แถบบน และหน้าต่าง popup ซึ่งอยู่นอกส่วนนี้)
    rules.push(`.requests-split, .dashboard-page, .editor-shell { zoom: ${theme.fontScale / 100}; }`);
  }
  return rules.join('\n');
};

// ธีมสำเร็จรูป: จับคู่สีมาให้เข้ากันทุกจุด กดแล้วยังปรับต่อเองได้
const g = (from, to, angle = 135, mix = 50) => ({ from, to, angle, mix });
export const THEME_PRESETS = [
  { name: 'ค่าเริ่มต้น', theme: {} },
  {
    name: 'Midnight',
    theme: {
      sidebarColor: g('#0b1120', '#1e293b', 180), sidebarTextColor: '#cbd5e1',
      topbarColor: '#0f172a', pageColor: g('#0b1120', '#1e1b4b', 135),
      panelColor: '#111827', panelOpacity: 85, textColor: '#e5e7eb', tableHeadTextColor: '#94a3b8',
      primaryButtonColor: g('#6366f1', '#8b5cf6', 90), secondaryButtonColor: '#1f2937', inputColor: '#1f2937',
      accentColor: '#818cf8',
    },
  },
  {
    name: 'Royal Magenta',
    theme: {
      sidebarColor: g('#1a0024', '#4a0a4a', 180), sidebarTextColor: '#f0d9ff',
      topbarColor: '#1a0024', pageColor: g('#12001f', '#7b0c7b', 135),
      panelColor: '#24062e', panelOpacity: 80, textColor: '#f8e9ff', tableHeadTextColor: '#e0a8f0',
      primaryButtonColor: g('#c026d3', '#7c3aed', 90), secondaryButtonColor: '#3b0f47', inputColor: '#2b0a35',
      accentColor: '#e879f9',
    },
  },
  {
    name: 'Sunset',
    theme: {
      sidebarColor: g('#3a1c71', '#d76d77', 180), sidebarTextColor: '#fde2e4',
      topbarColor: '#fff5ee', pageColor: g('#ff7e5f', '#feb47b', 135),
      panelColor: '#ffffff', panelOpacity: 80, textColor: '#3b1f2b', tableHeadTextColor: '#8a4b5c',
      primaryButtonColor: g('#ee0979', '#ff6a00', 90), secondaryButtonColor: '#ffffff', inputColor: '#ffffff',
      accentColor: '#e8590c',
    },
  },
  {
    name: 'Ocean',
    theme: {
      sidebarColor: g('#01579b', '#0288d1', 180), sidebarTextColor: '#e1f5fe',
      topbarColor: '#ffffff', pageColor: g('#e0f7fa', '#80deea', 180),
      panelColor: '#ffffff', panelOpacity: 85, textColor: '#0b3954', tableHeadTextColor: '#3d6b88',
      primaryButtonColor: g('#0288d1', '#26c6da', 90), secondaryButtonColor: '#ffffff', inputColor: '#ffffff',
      accentColor: '#0288d1',
    },
  },
  {
    name: 'Forest',
    theme: {
      sidebarColor: g('#1b4332', '#2d6a4f', 180), sidebarTextColor: '#d8f3dc',
      topbarColor: '#ffffff', pageColor: g('#eef5ee', '#cfe3cf', 180),
      panelColor: '#ffffff', panelOpacity: 90, textColor: '#1b2e24', tableHeadTextColor: '#52734d',
      primaryButtonColor: g('#2d6a4f', '#40916c', 90), secondaryButtonColor: '#ffffff', inputColor: '#ffffff',
      accentColor: '#2d6a4f',
    },
  },
];

// ตัวอย่างหน้าตาธีมบนการ์ดเลือกธีม
export const presetPreview = (preset) => ({
  sidebar: toCssFill(preset.theme.sidebarColor || THEME_FALLBACKS.sidebarColor),
  page: toCssFill(preset.theme.pageColor || THEME_FALLBACKS.pageColor),
  panel: preset.theme.panelColor || THEME_FALLBACKS.panelColor,
  accent: preset.theme.accentColor || THEME_FALLBACKS.accentColor,
  button: toCssFill(preset.theme.primaryButtonColor || THEME_FALLBACKS.primaryButtonColor),
});

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
