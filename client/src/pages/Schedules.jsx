import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const PRESETS = [
  { label: 'Every day at 8:00 AM', value: '0 8 * * *' },
  { label: 'Every day at 6:00 PM', value: '0 18 * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Weekdays at 9:00 AM', value: '0 9 * * 1-5' },
  { label: 'Every Monday at 9:00 AM', value: '0 9 * * 1' },
  { label: 'First day of month 9:00 AM', value: '0 9 1 * *' }
];

export default function Schedules() {
  const [templates, setTemplates] = useState([]);
  const [schedules, setSchedules] = useState({}); // templateId -> schedule
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const [{ templates }, { schedules }] = await Promise.all([
        api('/templates'),
        api('/schedules')
      ]);
      setTemplates(templates);
      const map = {};
      schedules.forEach(s => { map[s.template_id] = s; });
      setSchedules(map);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const startEdit = (template) => {
    const existing = schedules[template.id];
    setEditing({
      templateId: template.id,
      templateName: template.name,
      cron_expression: existing?.cron_expression || '0 8 * * *',
      timezone: existing?.timezone || 'Asia/Kolkata',
      active: existing?.active ?? 1
    });
  };

  const save = async () => {
    setError('');
    try {
      await api(`/schedules/template/${editing.templateId}`, {
        method: 'PUT',
        body: JSON.stringify({
          cron_expression: editing.cron_expression,
          timezone: editing.timezone,
          active: !!editing.active
        })
      });
      setEditing(null);
      refresh();
    } catch (e) { setError(e.message); }
  };

  const remove = async () => {
    if (!confirm('Remove schedule for this template?')) return;
    try {
      await api(`/schedules/template/${editing.templateId}`, { method: 'DELETE' });
      setEditing(null);
      refresh();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Schedules</h2>
      {error && <div style={errBox}>{error}</div>}

      {loading ? <p>Loading...</p> : templates.length === 0 ? (
        <div style={emptyStyle}>
          <p style={{ color: '#666' }}>No templates yet.</p>
        </div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Template</th>
              <th style={th}>Cron</th>
              <th style={th}>Timezone</th>
              <th style={th}>Active</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(t => {
              const s = schedules[t.id];
              return (
                <tr key={t.id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={td}><strong>{t.name}</strong></td>
                  <td style={td}><code>{s?.cron_expression || '—'}</code></td>
                  <td style={td}>{s?.timezone || '—'}</td>
                  <td style={td}>{s ? (s.active ? 'Yes' : 'No') : '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => startEdit(t)} style={smallBtn}>
                      {s ? 'Edit' : 'Set Schedule'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {editing && (
        <div style={modalBg} onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div style={modal}>
            <h3 style={{ marginTop: 0 }}>Schedule</h3>
            <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>{editing.templateName}</p>

            <label style={lbl}>Preset</label>
            <select
              onChange={(e) => setEditing({ ...editing, cron_expression: e.target.value })}
              style={inp}
              value=""
            >
              <option value="">— choose preset —</option>
              {PRESETS.map(p => <option key={p.value} value={p.value}>{p.label} ({p.value})</option>)}
            </select>

            <label style={lbl}>Cron expression</label>
            <input
              value={editing.cron_expression}
              onChange={(e) => setEditing({ ...editing, cron_expression: e.target.value })}
              style={{ ...inp, fontFamily: 'monospace' }}
            />
            <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
              Format: <code>minute hour day month day-of-week</code> — e.g. <code>0 8 * * *</code> = every day 8 AM
            </p>

            <label style={lbl}>Timezone</label>
            <input
              value={editing.timezone}
              onChange={(e) => setEditing({ ...editing, timezone: e.target.value })}
              style={inp}
            />

            <label style={{ display: 'flex', alignItems: 'center', marginTop: 12, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={!!editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked ? 1 : 0 })}
                style={{ marginRight: 6 }}
              />
              Active
            </label>

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={save} style={primaryBtn}>Save</button>
              {schedules[editing.templateId] && (
                <button onClick={remove} style={{ ...smallBtn, background: '#d93025' }}>Remove</button>
              )}
              <button onClick={() => setEditing(null)} style={{ ...smallBtn, background: '#888' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const tableStyle = { width: '100%', background: 'white', borderCollapse: 'collapse', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' };
const th = { textAlign: 'left', padding: '12px 16px', fontSize: 12, textTransform: 'uppercase', color: '#666', background: '#f5f5f5', fontWeight: 600 };
const td = { padding: '14px 16px', fontSize: 14 };
const primaryBtn = { padding: '8px 16px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 };
const smallBtn = { padding: '6px 12px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 };
const lbl = { display: 'block', fontSize: 12, color: '#555', marginBottom: 4, marginTop: 14 };
const inp = { width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 };
const errBox = { background: '#fce8e6', color: '#a50e0e', padding: '10px 14px', borderRadius: 6, marginBottom: 14, fontSize: 13 };
const emptyStyle = { textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: 8, border: '1px dashed #ddd' };
const modalBg = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modal = { background: 'white', padding: 24, borderRadius: 10, width: 460, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' };
