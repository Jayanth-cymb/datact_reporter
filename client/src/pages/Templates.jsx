import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export default function Templates({ user, onOpen }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingName, setUploadingName] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingSheets, setPendingSheets] = useState(null);
  const fileInputRef = useRef(null);

  const isAdmin = user.role === 'admin';

  const refresh = async () => {
    setLoading(true);
    try {
      const { templates } = await api('/templates');
      setItems(templates);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    window.LuckyExcel.transformExcelToLucky(file, (exportJson) => {
      if (!exportJson?.sheets?.length) {
        setError('Failed to read Excel file');
        return;
      }
      setPendingFile(file);
      setPendingSheets(exportJson.sheets);
      setUploadingName(file.name.replace(/\.[^.]+$/, ''));
    });
    e.target.value = '';
  };

  const saveNew = async () => {
    if (!pendingSheets || !uploadingName.trim()) return;
    try {
      await api('/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: uploadingName.trim(),
          description: '',
          sheet_json: pendingSheets,
          input_cells: []
        })
      });
      setPendingFile(null);
      setPendingSheets(null);
      setUploadingName('');
      refresh();
    } catch (e) { setError(e.message); }
  };

  const remove = async (t) => {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    try {
      await api(`/templates/${t.id}`, { method: 'DELETE' });
      refresh();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>Templates</h2>
        {isAdmin && (
          <button onClick={() => fileInputRef.current.click()} style={primaryBtn}>
            + Upload Excel
          </button>
        )}
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx,.xls"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
      </div>

      {error && <div style={errBox}>{error}</div>}

      {loading ? <p>Loading...</p> : items.length === 0 ? (
        <div style={emptyStyle}>
          <p style={{ fontSize: 16, color: '#666' }}>No templates yet</p>
          {isAdmin && <p style={{ color: '#999' }}>Click "Upload Excel" to add the first template</p>}
        </div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Description</th>
              <th style={th}>Created</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(t => (
              <tr key={t.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={td}>
                  <a onClick={() => onOpen(t.id)}
                     style={{ color: '#1a73e8', cursor: 'pointer', fontWeight: 500 }}>
                    {t.name}
                  </a>
                </td>
                <td style={{ ...td, color: '#666' }}>{t.description || '—'}</td>
                <td style={td}>{new Date(t.created_at).toLocaleDateString()}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button onClick={() => onOpen(t.id)} style={smallBtn}>Open</button>
                  {isAdmin && (
                    <button onClick={() => remove(t)} style={{ ...smallBtn, background: '#888' }}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pendingSheets && (
        <div style={modalBg} onClick={(e) => e.target === e.currentTarget && setPendingSheets(null)}>
          <div style={modal}>
            <h3 style={{ marginTop: 0 }}>Name this template</h3>
            <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
              From: {pendingFile?.name}
            </p>
            <label style={lbl}>Template name</label>
            <input
              autoFocus
              value={uploadingName}
              onChange={(e) => setUploadingName(e.target.value)}
              placeholder="e.g. Production Log"
              style={inp}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={saveNew} style={primaryBtn}>Save Template</button>
              <button onClick={() => { setPendingSheets(null); setPendingFile(null); }}
                style={{ ...smallBtn, background: '#888' }}>Cancel</button>
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
const lbl = { display: 'block', fontSize: 12, color: '#555', marginBottom: 4, marginTop: 10 };
const inp = { width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 };
const errBox = { background: '#fce8e6', color: '#a50e0e', padding: '10px 14px', borderRadius: 6, marginBottom: 14, fontSize: 13 };
const emptyStyle = { textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: 8, border: '1px dashed #ddd' };
const modalBg = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modal = { background: 'white', padding: 24, borderRadius: 10, width: 380, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' };
