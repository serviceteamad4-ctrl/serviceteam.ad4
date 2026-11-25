import crypto from 'crypto';

const LED_SHEET_ID = process.env.BMN_LED_SHEET_ID || '1LvP0Z8fwOdE1B4jJRuE9P6uInlbqoAaw8daoap01RyA';
const DYN_SHEET_ID = process.env.BMN_DYNAMIC_SHEET_ID || '1NoVBzo3bj5OMsoAogfL8UuqnVKpBJOqs5xYnon7O8oI';
const SHEET_TAB = 'IssueLog2568';

// Per-spreadsheet mutex queue to prevent race conditions on row numbers / JobNo
const queues = new Map();
function enqueue(sheetId, fn) {
  const prev = queues.get(sheetId) || Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(sheetId, next.catch(() => {}));
  return next;
}

export function isBmnCustomer(customer) {
  const clean = String(customer || '').replace(/[\u0E00-\u0E7F\s]/g, (ch) => (ch === 'ฺ' ? '' : ch)).trim().toLowerCase();
  return clean === 'bmn' || clean.includes('bmn');
}

// ==================== GOOGLE AUTH (Service Account OR OAuth2 Refresh Token) ====================
let cachedToken = { accessToken: null, expiresAt: 0 };

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getGoogleAccessToken() {
  if (cachedToken.accessToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  // Option 1: Service Account JSON
  const saRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (saRaw) {
    const sa = JSON.parse(saRaw);
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = base64url(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }));
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${header}.${claim}`);
    const sig = signer.sign(sa.private_key, 'base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${header}.${claim}.${sig}`,
      }),
    });
    if (!res.ok) throw new Error(`Google SA token error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
    return cachedToken.accessToken;
  }

  // Option 2: OAuth2 Refresh Token
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) throw new Error(`Google OAuth token error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
    return cachedToken.accessToken;
  }

  return null;
}

// ==================== GOOGLE SHEETS REST HELPERS ====================
async function readSheetRange(sheetId, range, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets read failed (${sheetId}): ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.values || [];
}

async function writeSheetRange(sheetId, range, values, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) throw new Error(`Sheets write failed (${sheetId} ${range}): ${res.status} ${await res.text()}`);
  return res.json();
}

// ==================== DATE / TIME FORMATTING (ASIA/BANGKOK) ====================
function fmtBkkDateTime(iso) {
  if (!iso) return { d: '', t: '' };
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return { d: '', t: '' };
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(dt);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return {
    d: `${get('day')}/${get('month')}/${get('year')}`,
    t: `${Number(hour)}:${get('minute')}:00`,
  };
}

// ==================== CLASSIFICATION & POLISHING ====================
function mapStatus(sdStatus) {
  const s = String(sdStatus || '').trim();
  if (s === 'เรียบร้อยปกติ') return 'Finish';
  if (s === 'ยกเลิก') return 'Cancel';
  if (s === 'รออะไหล่' || s === 'เสนอราคา') return 'Waiting';
  if (s === 'รับเรื่อง' || s === 'กำลังดำเนินการ' || s === 'นัดหมาย') return 'On-Process';
  return 'On-Process';
}

function cleanThaiRaw(text) {
  return String(text || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF✅❌]/gu, '')
    .replace(/ครับ|ค่ะ|นะคะ|นะครับ/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackClassifyAndPolish(req) {
  const combined = `${req.location || ''} ${req.site || ''} ${req.description || ''} ${req.action || ''} ${req.result || ''} ${req.notes || ''}`.toLowerCase();
  const isDynamic = /dynamic|ไดนามิก|dlb|dnl|เปลี่ยนสื่อจอ dynamic|แผ่นผ้า/.test(combined);
  const sheetType = isDynamic ? 'dynamic' : 'led';

  const isOnline = /รีโมท|remote|on-?line|restart\s*player|อัพสื่อออนไลน์|เปลี่ยนสื่อใหม่ผ่านระบบ/i.test(`${req.jobType || ''} ${req.action || ''}`);
  const method = isOnline ? 'On-line' : 'On-Site';

  let issueType = 'LED ทำงานไม่ถูกต้อง : จอไม่ทำงาน';
  let group = 'LED Screen';
  let category = 'Other';

  if (/เปลี่ยนสื่อ|ขึ้นสื่อ|อัพเดทสื่อ|อัปเดตสื่อ/.test(combined)) {
    issueType = isDynamic ? 'เปลี่ยนสื่อจอ Dynamic ' : 'Media ทำงานไม่ถูกต้อง : สื่อเล่นไม่ตรง';
    group = 'Content';
    category = 'Content';
  } else if (/offline|ออฟไลน์|offlin|ไม่ออนไลน์/.test(combined)) {
    issueType = 'Player ทำงานไม่ถูกต้อง : Offline';
    group = 'Network';
    category = 'Player';
  } else if (/สีเพี้ยน/.test(combined)) {
    issueType = 'LED ทำงานไม่ถูกต้อง : Module สีเพี้ยน';
    group = 'LED Screen';
    category = 'Module';
  } else if (/หลุด/.test(combined)) {
    issueType = 'LED ทำงานไม่ถูกต้อง : Module หลุด';
    group = 'LED Screen';
    category = 'Module';
  } else if (/โมดูล|แผ่นเสีย|แผ่นดับ|module/.test(combined)) {
    issueType = 'LED ทำงานไม่ถูกต้อง : Module ชำรุด';
    group = 'LED Screen';
    category = 'Module';
  } else if (/กระพริบ/.test(combined)) {
    issueType = 'Media ทำงานไม่ถูกต้อง : สื่อเล่นกระพริบ';
    group = 'LED Screen';
    category = 'Other';
  } else if (/เบรกเกอร์|breaker|หม้อแปลง|power|ไฟ/.test(combined)) {
    group = 'Electrical';
    category = /เบรกเกอร์|breaker/.test(combined) ? 'Breaker' : 'Power Supply';
  } else if (/cctv/.test(combined)) {
    issueType = 'อื่นๆ : ระบบ CCTV';
    group = 'Hardware';
    category = 'Other';
  }

  const screenName = (req.location || req.site || 'ไม่ระบุ').trim();
  const desc = cleanThaiRaw(req.description) || 'แจ้งตรวจสอบระบบจอ';
  const rawAction = cleanThaiRaw(req.action || req.result);
  const status = mapStatus(req.status);

  let found = desc;
  let solution = rawAction;
  if (!solution) {
    if (status === 'Finish') {
      found = `เข้าตรวจสอบ${desc}`;
      solution = 'ดำเนินการตรวจสอบและแก้ไขเรียบร้อย จอแสดงผลปกติ';
    } else if (status === 'Waiting') {
      found = desc;
      solution = 'อยู่ระหว่างรออะไหล่/ดำเนินการ';
    } else {
      found = desc;
      solution = 'อยู่ระหว่างเข้าตรวจสอบและดำเนินการ';
    }
  } else {
    found = `ตรวจสอบพบ: ${rawAction}`;
    solution = status === 'Finish' ? `${rawAction} (ดำเนินการเรียบร้อย)` : rawAction;
  }

  return { sheetType, screenName, issueType, desc, found, solution, group, category, method };
}

async function polishWithGemini(req) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `คุณคือแอดมินทีมช่างป้ายดิจิทัล (Dr) ที่ต้องสรุปข้อมูลแจ้งซ่อมของลูกค้า BMN จากระบบภายในลงในรายงานส่งลูกค้า (Google Sheets)
กติกา:
1. sheetType: "dynamic" เฉพาะจอ Dynamic Light Box (จอแผ่นผ้า แสงไฟข้างหลัง, DLB, DNL, หรือระบุ Dynamic) ที่เหลือทั้งหมดเป็น "led"
2. ขัดเกลาคำพูด (desc, found, solution) ให้สุภาพ กระชับ ชัดเจน เหมาะสำหรับลูกค้าอ่าน ตัดคำสแลง อีโมจิ คำลงท้าย (ครับ/ค่ะ) รหัสผ่าน หรือชื่อเล่นช่างออก แต่คงข้อเท็จจริงทางเทคนิคครบถ้วน ห้ามใช้เครื่องหมาย % (ให้เขียนคำว่า "เปอร์เซ็นต์" แทน)
3. group ต้องเป็นหนึ่งใน: Content, Electrical, External, Hardware, LED Screen, Network, Software
4. category ต้องเป็นหนึ่งใน: Player, Content, Network, Module, Flat cable, communication cable, Power cable, Power Supply, Breaker, Recived Card, Processor, Other
5. method ต้องเป็น "On-line" หรือ "On-Site"

ข้อมูลจากระบบภายใน:
- location: ${req.location || ''}
- site: ${req.site || ''}
- jobType: ${req.jobType || ''}
- status: ${req.status || ''}
- description: ${req.description || ''}
- action: ${req.action || ''}
- result: ${req.result || ''}
- notes: ${req.notes || ''}

ตอบเป็น JSON object เท่านั้น โดยมี keys: sheetType, screenName, issueType, desc, found, solution, group, category, method`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (!parsed.sheetType || !parsed.desc) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ==================== MAIN SYNC FUNCTION ====================
export async function syncBmnRequestToSheet(req) {
  if (!req || !isBmnCustomer(req.customer)) return;

  const token = await getGoogleAccessToken();
  if (!token) {
    // Google Sheets credentials not configured yet — skip silently
    return;
  }

  const sheetStatus = mapStatus(req.status);
  const ai = await polishWithGemini(req);
  const info = ai || fallbackClassifyAndPolish(req);
  const sheetId = info.sheetType === 'dynamic' ? DYN_SHEET_ID : LED_SHEET_ID;

  const start = fmtBkkDateTime(req.receivedAt || req.createdAt);
  const end = fmtBkkDateTime(req.completedAt);
  if (!start.d) return;

  await enqueue(sheetId, async () => {
    const rows = await readSheetRange(sheetId, `${SHEET_TAB}!A1:Z2000`, token);

    // Find existing row by matching Date + Time (col D & col E) or ticket in comment (col Z)
    let targetIdx = -1;
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] || [];
      if (req.ticket && String(r[25] || '').includes(req.ticket)) {
        targetIdx = i;
        break;
      }
      if (r[3] === start.d && r[4] === start.t) {
        targetIdx = i;
        break;
      }
    }

    // Don't insert brand-new Cancel rows (match existing sheet convention)
    if (targetIdx === -1 && sheetStatus === 'Cancel') {
      return;
    }

    let noVal = '';
    let jobNoVal = '';

    if (targetIdx !== -1) {
      noVal = rows[targetIdx][0] || '';
      jobNoVal = rows[targetIdx][1] || '';
    } else {
      // Find first empty template row (has No/JobNo but no Date) OR append after last populated row
      let lastPopIdx = 1;
      let firstTemplateIdx = -1;
      for (let i = 2; i < rows.length; i++) {
        const r = rows[i] || [];
        if (r[3] || r[5] || r[7]) {
          lastPopIdx = i;
          firstTemplateIdx = -1;
        } else if ((r[0] || r[1]) && firstTemplateIdx === -1) {
          firstTemplateIdx = i;
        }
      }

      if (firstTemplateIdx !== -1) {
        targetIdx = firstTemplateIdx;
        noVal = rows[targetIdx][0];
        jobNoVal = rows[targetIdx][1];
      } else {
        targetIdx = lastPopIdx + 1;
        const prevNo = Number(rows[lastPopIdx]?.[0] || 0);
        const nextNo = prevNo + 1;
        noVal = String(nextNo);
        if (info.sheetType === 'dynamic') {
          jobNoVal = `JOB-${nextNo}`;
        } else {
          jobNoVal = `JOB-2025-${String(nextNo).padStart(4, '0')}`;
        }
      }
    }

    const row = new Array(26).fill('');
    row[0] = noVal;
    row[1] = jobNoVal;
    row[2] = 'BMN';
    row[3] = start.d;
    row[4] = start.t;
    row[5] = info.screenName;
    row[6] = info.issueType;
    row[7] = info.desc;
    row[8] = sheetStatus;
    row[9] = 'Dr';
    row[10] = info.found;
    row[11] = info.solution;
    row[12] = info.group;
    row[13] = info.category;
    row[14] = info.method;

    if (sheetStatus === 'Finish' && end.d) {
      if (info.method === 'On-line') {
        row[15] = start.d;
        row[16] = start.t;
        row[17] = end.d;
        row[18] = end.t;
      } else {
        row[19] = end.d;
        row[21] = end.d;
        row[22] = end.t;
        row[23] = end.d;
        row[24] = end.t;
      }
    }
    if (req.ticket) row[25] = req.ticket;

    const rowNum = targetIdx + 1;
    await writeSheetRange(sheetId, `${SHEET_TAB}!A${rowNum}:Z${rowNum}`, [row], token);
    console.log(`[BMN Sync] ${req.ticket || req.id} -> ${info.sheetType.toUpperCase()} ${jobNoVal} (Row ${rowNum}, ${sheetStatus})`);
  });
}

export function triggerBmnSync(req) {
  if (!req || !isBmnCustomer(req.customer)) return;
  syncBmnRequestToSheet(req).catch((err) => {
    console.error('[BMN Sync Error]', req.ticket || req.id, err.message);
  });
}
