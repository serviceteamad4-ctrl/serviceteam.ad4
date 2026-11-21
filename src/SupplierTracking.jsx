import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { FileField } from './App.jsx';

// งานติดตามซัพ: เก็บในตาราง supplier_tasks แยกจากงานแจ้งบริการโดยสิ้นเชิง
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const STATUSES = ['แจ้งแล้ว', 'ติดตามแล้ว', 'แก้แล้ว'];
const STATUS_COLOR = { 'แจ้งแล้ว': '#d97706', 'ติดตามแล้ว': '#2563eb', 'แก้แล้ว': '#16a34a' };
const EMPTY = { supplier: '', topic: '', location: '', notified_at: '', status: 'แจ้งแล้ว', follow_up_at: '', note: '', image: '', fixed_image: '' };

// input datetime-local ต้องการ "YYYY-MM-DDTHH:mm" เวลาไทย
const toLocalInput = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};
const shortDate = (value) => (value ? new Intl.DateTimeFormat('th-TH-u-ca-gregory', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value)) : '-');
const daysSince = (value) => (value ? Math.max(0, Math.floor((Date.now() - new Date(value)) / 86400000)) : null);

const api = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}/api/supplier-tasks${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
  return response.status === 204 ? null : response.json();
};

export default function SupplierTracking() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState('ทั้งหมด');
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api('').then(setTasks).catch((e) => Swal.fire({ icon: 'error', title: 'โหลดงานซัพไม่สำเร็จ', text: e.message })).finally(() => setLoading(false));
  }, []);

  const fail = (e) => Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: e.message, confirmButtonText: 'ปิด' });
  const upsert = (saved) => setTasks((list) => (list.some((t) => t.id === saved.id) ? list.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...list]));

  const save = async (form) => {
    try {
      const saved = form.id
        ? await api(`/${form.id}`, { method: 'PUT', body: JSON.stringify(form) })
        : await api('', { method: 'POST', body: JSON.stringify(form) });
      upsert(saved);
      setEditing(null);
    } catch (e) { fail(e); }
  };

  const remove = async (task) => {
    const ok = await Swal.fire({ icon: 'warning', title: 'ลบงานซัพนี้?', text: task.topic || task.supplier, showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626' });
    if (!ok.isConfirmed) return;
    try {
      await api(`/${task.id}`, { method: 'DELETE' });
      setTasks((list) => list.filter((t) => t.id !== task.id));
      setEditing(null);
    } catch (e) { fail(e); }
  };

  const quick = async (task, status) => {
    setBusyId(task.id);
    try {
      upsert(await api(`/${task.id}`, { method: 'PUT', body: JSON.stringify(status === 'แจ้งแล้ว' ? { status } : { status, follow_up_at: new Date().toISOString() }) }));
    } catch (e) { fail(e); } finally { setBusyId(null); }
  };

  const done = (t) => t.status === 'แก้แล้ว';
  const since = (t) => t.notified_at || t.created_at;
  const suppliers = useMemo(() => Array.from(new Set(tasks.map((t) => (t.supplier || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'th')), [tasks]);
  const groups = useMemo(() => {
    const items = tasks
      .filter((t) => showDone || !done(t))
      .filter((t) => supplierFilter === 'ทั้งหมด' || t.supplier.trim() === supplierFilter);
    return suppliers
      .map((name) => ({ name, items: items.filter((t) => t.supplier.trim() === name).sort((a, b) => new Date(since(a)) - new Date(since(b))) }))
      .filter((g) => g.items.length);
  }, [tasks, suppliers, showDone, supplierFilter]);
  const open = tasks.filter((t) => !done(t));

  const cell = { padding: '10px', borderBottom: '1px solid var(--line-color, #eef1ef)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' };
  const btn = { padding: '3px 8px', borderRadius: '8px', border: '1px solid var(--line-color, #ccc)', background: 'transparent', color: 'inherit', fontSize: '12px', cursor: 'pointer', marginRight: '4px' };
  const headers = ['รูป', 'ซัพแจ้งเรื่อง', 'สาขา/สถานที่', 'แจ้งเมื่อ', 'สถานะ', 'ติดตามล่าสุด / ผล', 'ค้าง (วัน)', 'อัปเดต'];

  return (
    <section style={{ padding: '8px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, color: 'var(--ink)' }}>ติดตามงานซัพ</h2>
        <button type="button" className="primary-btn" onClick={() => setEditing({ ...EMPTY, notified_at: toLocalInput() })}>+ เพิ่มงานซัพ</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {[['งานซัพที่ยังไม่แก้', open.length], ['ยังไม่ได้ติดตาม', open.filter((t) => t.status !== 'ติดตามแล้ว').length], ['จำนวนซัพ', suppliers.length], ['งานซัพทั้งหมด', tasks.length]].map(([label, value]) => (
          <div key={label} className="metric" style={{ border: '1px solid #edf0ef', borderRadius: '18px', padding: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', marginBottom: '10px' }}>{label}</label>
            <strong style={{ display: 'block', fontSize: '28px', lineHeight: 1.2, color: 'var(--ink)' }}>{value}</strong>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} style={{ height: '40px', borderRadius: '12px', padding: '0 12px', minWidth: '200px' }}>
          <option>ทั้งหมด</option>
          {suppliers.map((s) => <option key={s}>{s}</option>)}
        </select>
        <label style={{ display: 'flex', gap: '6px', alignItems: 'center', color: 'var(--ink)' }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> แสดงงานที่แก้แล้ว
        </label>
      </div>

      {loading ? <p style={{ color: 'var(--ink)' }}>กำลังโหลด…</p> : groups.length === 0 ? (
        <p style={{ color: 'var(--ink)' }}>ยังไม่มีงานซัพ — กดปุ่ม "+ เพิ่มงานซัพ" มุมขวาบน</p>
      ) : groups.map((group) => (
        <div key={group.name} style={{ marginBottom: '18px', border: '1px solid var(--line-color, #e4e9e8)', borderRadius: '14px', overflowX: 'auto' }}>
          <div style={{ padding: '10px 14px', fontWeight: 700, background: 'var(--table-group-bg, #f4f9f9)', color: 'var(--ink)' }}>
            {group.name} <span style={{ fontWeight: 400 }}>({group.items.length} งาน)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '0.5fr 2fr 1.1fr 0.9fr 0.8fr 1.8fr 0.6fr 1.3fr', minWidth: '1020px', fontSize: '13px', color: 'var(--ink)' }}>
            {headers.map((h) => <div key={h} style={{ ...cell, cursor: 'default', fontWeight: 700, background: 'var(--table-head-bg, #f7f8fc)' }}>{h}</div>)}
            {group.items.map((t) => {
              const days = done(t) ? null : daysSince(since(t));
              const follow = [t.follow_up_at && shortDate(t.follow_up_at), t.note].filter(Boolean).join(' · ') || '-';
              const edit = () => setEditing({ ...t, notified_at: t.notified_at ? toLocalInput(t.notified_at) : '', follow_up_at: t.follow_up_at ? toLocalInput(t.follow_up_at) : '' });
              return (
                <React.Fragment key={t.id}>
                  <div style={{ ...cell, padding: '4px 10px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {[t.image, t.fixed_image].filter(Boolean).map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        <img src={url} alt="" loading="lazy" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px', display: 'block' }} />
                      </a>
                    ))}
                    {!t.image && !t.fixed_image && <span onClick={edit}>-</span>}
                  </div>
                  <div style={cell} onClick={edit} title={t.topic}>{t.topic || '-'}</div>
                  <div style={cell} onClick={edit} title={t.location}>{t.location || '-'}</div>
                  <div style={cell} onClick={edit}>{shortDate(t.notified_at)}</div>
                  <div style={{ ...cell, fontWeight: 700, color: STATUS_COLOR[t.status] }} onClick={edit}>{t.status}</div>
                  <div style={cell} onClick={edit} title={follow}>{follow}</div>
                  <div style={{ ...cell, fontWeight: 700, color: days !== null && days >= 7 ? '#dc2626' : 'inherit' }} onClick={edit}>{days ?? '-'}</div>
                  <div style={{ ...cell, cursor: 'default' }}>
                    {/* ปุ่มสถานะทั้ง 3 ตัว: ตัวที่เป็นสถานะปัจจุบันจะทึบสี กดเปลี่ยนกลับไปมาได้ (รวมย้อนกลับเป็น "แจ้งแล้ว") */}
                    {STATUSES.map((s) => {
                      const active = t.status === s;
                      const color = STATUS_COLOR[s];
                      return (
                        <button
                          key={s}
                          type="button"
                          style={{ ...btn, color: active ? '#fff' : color, borderColor: color, background: active ? color : 'transparent' }}
                          disabled={busyId === t.id || active}
                          onClick={() => quick(t, s)}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ))}

      {editing && <TaskForm task={editing} suppliers={suppliers} onClose={() => setEditing(null)} onSave={save} onDelete={() => remove(editing)} />}
    </section>
  );
}

function TaskForm({ task, suppliers, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(task);
  const [saving, setSaving] = useState(false);
  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const field = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' };
  const input = { padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--line-color, #ccc)', font: 'inherit', background: 'transparent', color: 'inherit' };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50 }}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="detail-card" style={{ width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: '18px', padding: '20px', display: 'grid', gap: '12px', color: 'var(--ink)' }}>
        <h3 style={{ margin: 0 }}>{task.id ? 'แก้ไขงานซัพ' : 'เพิ่มงานซัพ'}</h3>
        <label style={field}>ซัพพลายเออร์ *
          <input name="supplier" list="supplier-names" value={form.supplier} onChange={set} required style={input} />
          <datalist id="supplier-names">{suppliers.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
        <label style={field}>แจ้งเรื่องอะไร
          <textarea name="topic" rows={3} value={form.topic || ''} onChange={set} style={input} />
        </label>
        <ImageSlot name="image" label="รูปตอนแจ้ง" value={form.image} onChange={set} />
        <label style={field}>สาขา/สถานที่
          <input name="location" value={form.location || ''} onChange={set} style={input} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <label style={field}>แจ้งเมื่อ
            <input type="datetime-local" name="notified_at" value={form.notified_at || ''} onChange={set} style={input} />
          </label>
          <label style={field}>สถานะ
            <select name="status" value={form.status} onChange={set} style={input}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label style={field}>ติดตามล่าสุดเมื่อ
          <input type="datetime-local" name="follow_up_at" value={form.follow_up_at || ''} onChange={set} style={input} />
        </label>
        <label style={field}>ผลการติดตาม / ซัพตอบว่าอะไร
          <textarea name="note" rows={3} value={form.note || ''} onChange={set} style={input} />
        </label>
        <ImageSlot name="fixed_image" label="รูปหลังซัพแก้แล้ว" value={form.fixed_image} onChange={set} />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {task.id && <button type="button" className="secondary-btn" onClick={onDelete} style={{ marginRight: 'auto', color: '#dc2626' }}>ลบ</button>}
          <button type="button" className="secondary-btn" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
        </div>
      </form>
    </div>
  );
}

// ช่องรูป: ใช้ตัวอัปโหลดเดียวกับฟอร์มงาน (เลือกไฟล์ / Ctrl+V) และแสดงรูปตัวอย่าง + ปุ่มเอารูปออก
function ImageSlot({ name, label, value, onChange }) {
  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      <FileField name={name} label={label} value={value} onChange={onChange} />
      {value && (
        <button type="button" className="secondary-btn" style={{ justifySelf: 'start' }} onClick={() => onChange({ target: { name, value: '' } })}>เอารูปออก</button>
      )}
    </div>
  );
}
