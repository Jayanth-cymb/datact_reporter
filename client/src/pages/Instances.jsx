import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const STATUS_COLORS = {
  draft: '#888', pending: '#e8a317', approved: '#2e9e4d', rejected: '#d93025'
};
const STATUS_LABELS = {
  draft: 'Draft', pending: 'Pending Approval', approved: 'Approved', rejected: 'Rejected'
};

export default function Instances({ user, onOpen }) {
  const [items, setItems] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [{ instances }, { templates }] = await Promise.all([
        api('/instances?mine=1'),
        api('/templates')
      ]);
      setItems(instances);
      setTemplates(templates);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const startNew = async (templateId) => {
    try {
      const { id } = await api('/instances', {
        method: 'POST',
        body: JSON.stringify({ template_id: templateId })
      });
      setShowPicker(false);
      onOpen(id);
    } catch (e) { setError(e.message); }
  };

  const remove = async (inst) => {
    if (!confirm('Delete this draft?')) return;
    try {
      await api(`/instances/${inst.id}`, { method: 'DELETE' });
      refresh();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>My Check Sheets</h2>
        <button onClick={() => setShowPicker(true)} style={primaryBtn}>+ New Check Sheet</button>
      </div>

      {error && <div style={errBox}>{error}</div>}

      {loading ? <p>Loading...</p> : items.length === 0 ? (
        <div style={emptyStyle}>
          <p style={{ fontSize: 16, color: '#666' }}>No check sheets yet</p>
          <p style={{ color: '#999' }}>Click "+ New Check Sheet" to start one</p>
        </div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Template</th>
              <th style={th}>Status</th>
              <th style={th}>Started</th>
              <th style={th}>Submitted</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={td}>
                  <a onClick={() => onOpen(it.id)}
                     style={{ color: '#1a73e8', cursor: 'pointer', fontWeight: 500 }}>
                    {it.template_name}
                  </a>
                </td>
                <td style={td}>
                  <span style={badge(STATUS_COLORS[it.status])}>{STATUS_LABELS[it.status]}</span>
                </td>
                <td style={td}>{new Date(it.created_at).toLocaleString()}</td>
                <td style={td}>{it.submitted_at ? new Date(it.submitted_at).toLocaleString() : '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button onClick={() => onOpen(it.id)} style={smallBtn}>Open</button>
                  {it.status === 'draft' && (
                    <button onClick={() => remove(it)} style={{ ...smallBtn, background: '#888' }}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showPicker && (
        <div style={modalBg} onClick={(e) => e.target === e.currentTarget && setShowPicker(false)}>
          <div style={modal}>
            <h3 style={{ marginTop: 0 }}>Select a Template</h3>
            {templates.length === 0 ? (
              <p style={{ color: '#888' }}>No templates available. Ask an admin to upload one.</p>
            ) : (
              <div style={{ maxHeight: 360, overflow: 'auto' }}>
                {templates.map(t => (
                  <div key={t.id} onClick={() => startNew(t.id)} style={tplPick}>
                    <div style={{ fontWeight: 500 }}>{t.name}</div>
                    {t.description && <div style={{ fontSize: 12, color: '#666' }}>{t.description}</div>}
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <button onClick={() => setShowPicker(false)} style={{ ...smallBtn, background: '#888' }}>Cancel</button>
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
const primaryBtn = { padding: '8px 16px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14, marginLeft: 'auto' };
const smallBtn = { padding: '5px 11px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginLeft: 6 };
const errBox = { background: '#fce8e6', color: '#a50e0e', padding: '10px 14px', borderRadius: 6, marginBottom: 14, fontSize: 13 };
const emptyStyle = { textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: 8, border: '1px dashed #ddd' };
const modalBg = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modal = { background: 'white', padding: 24, borderRadius: 10, width: 420, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' };
const tplPick = { padding: '10px 12px', borderRadius: 6, cursor: 'pointer', border: '1px solid #eee', marginBottom: 6 };
function badge(bg) {
  return {
    display: 'inline-block', padding: '3px 10px', borderRadius: 12, color: 'white',
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', background: bg
  };
}
