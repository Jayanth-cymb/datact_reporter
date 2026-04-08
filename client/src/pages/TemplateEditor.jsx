import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const FIELD_TYPES = ['text', 'number', 'date', 'checkbox'];
const HIGHLIGHT_BG = '#fff3cd';

export default function TemplateEditor({ id, user, onBack }) {
  const [template, setTemplate] = useState(null);
  const [inputCells, setInputCells] = useState([]);
  const [status, setStatus] = useState('Loading...');
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [pendingCell, setPendingCell] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const initRef = useRef(false);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { template } = await api(`/templates/${id}`);
        if (cancelled) return;
        setTemplate(template);
        setInputCells(template.input_cells || []);
        setTimeout(() => initLuckysheet(template), 50);
        setStatus('');
      } catch (e) { setStatus('Error: ' + e.message); }
    })();
    return () => {
      cancelled = true;
      try { window.luckysheet.destroy(); } catch {}
      initRef.current = false;
    };
  }, [id]);

  const initLuckysheet = (tpl) => {
    if (initRef.current) return;
    initRef.current = true;
    window.luckysheet.create({
      container: 'luckysheet',
      lang: 'en',
      showinfobar: false,
      allowEdit: isAdmin, // admins editing the template structure
      data: tpl.sheet_json,
      hook: {}
    });
    // Apply highlights for existing input cells after initial render
    setTimeout(() => applyHighlights(tpl.input_cells || []), 400);
  };

  const applyHighlights = (cells) => {
    if (!window.luckysheet) return;
    cells.forEach(c => {
      try {
        window.luckysheet.setCellFormat(c.row, c.col, 'bg', HIGHLIGHT_BG, { order: c.sheetIndex || 0 });
      } catch {}
    });
  };

  const handleMarkAsInput = () => {
    if (!window.luckysheet) return;
    const range = window.luckysheet.getRange();
    if (!range || range.length === 0) {
      alert('Select a cell first');
      return;
    }
    const r = range[0].row[0];
    const c = range[0].column[0];
    const sheetIndex = window.luckysheet.getSheet().order || 0;
    const existing = inputCells.find(x => x.row === r && x.col === c && (x.sheetIndex || 0) === sheetIndex);
    if (existing) {
      setEditingField(existing);
      setPendingCell(null);
    } else {
      setPendingCell({ row: r, col: c, sheetIndex });
      setEditingField({ label: '', type: 'text', required: true });
    }
    setShowFieldModal(true);
  };

  const saveField = () => {
    const cell = pendingCell || { row: editingField.row, col: editingField.col, sheetIndex: editingField.sheetIndex };
    const newField = {
      row: cell.row,
      col: cell.col,
      sheetIndex: cell.sheetIndex || 0,
      label: editingField.label.trim() || `Field at R${cell.row + 1}C${cell.col + 1}`,
      type: editingField.type,
      required: !!editingField.required
    };
    const updated = inputCells.filter(x => !(x.row === cell.row && x.col === cell.col && (x.sheetIndex || 0) === (cell.sheetIndex || 0)));
    updated.push(newField);
    setInputCells(updated);
    try {
      window.luckysheet.setCellFormat(cell.row, cell.col, 'bg', HIGHLIGHT_BG, { order: cell.sheetIndex || 0 });
    } catch {}
    setShowFieldModal(false);
    setPendingCell(null);
    setEditingField(null);
  };

  const removeField = () => {
    const cell = editingField;
    const updated = inputCells.filter(x => !(x.row === cell.row && x.col === cell.col && (x.sheetIndex || 0) === (cell.sheetIndex || 0)));
    setInputCells(updated);
    try {
      window.luckysheet.setCellFormat(cell.row, cell.col, 'bg', null, { order: cell.sheetIndex || 0 });
    } catch {}
    setShowFieldModal(false);
    setEditingField(null);
  };

  const handleSave = async () => {
    if (!template) return;
    setStatus('Saving...');
    try {
      const sheet_json = window.luckysheet.getAllSheets();
      await api(`/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ sheet_json, input_cells: inputCells })
      });
      setStatus('Saved');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) { setStatus('Error: ' + e.message); }
  };

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '10px 16px', background: '#f5f5f5', borderBottom: '1px solid #ddd',
        display: 'flex', gap: 10, alignItems: 'center'
      }}>
        <button onClick={onBack} style={btnStyle}>← Back</button>
        <strong>{template?.name || '...'}</strong>
        <span style={{ color: '#666', fontSize: 12 }}>
          {inputCells.length} input field{inputCells.length === 1 ? '' : 's'}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {isAdmin && (
            <>
              <button onClick={handleMarkAsInput} style={{ ...btnStyle, background: '#e8a317' }}>
                Mark Selected Cell as Input Field
              </button>
              <button onClick={handleSave} style={{ ...btnStyle, background: '#2e9e4d' }}>Save</button>
            </>
          )}
          <span style={{ color: '#555', fontSize: 12, marginLeft: 8 }}>{status}</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div id="luckysheet" style={{ flex: 1, position: 'relative' }} />
        <aside style={{
          width: 260, background: '#fafafa', borderLeft: '1px solid #e0e0e0',
          padding: 12, overflow: 'auto'
        }}>
          <h4 style={{ marginTop: 0, marginBottom: 8 }}>Input Fields</h4>
          {inputCells.length === 0 ? (
            <p style={{ fontSize: 12, color: '#999' }}>
              {isAdmin ? 'Select a cell and click "Mark Selected Cell as Input Field" to begin.' : 'No input fields defined.'}
            </p>
          ) : (
            inputCells
              .sort((a, b) => a.row - b.row || a.col - b.col)
              .map((f, i) => (
                <div key={i} style={fieldRow}
                  onClick={() => isAdmin && (setEditingField(f), setPendingCell(null), setShowFieldModal(true))}
                >
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{f.label}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>
                    R{f.row + 1}C{f.col + 1} • {f.type}{f.required ? ' • required' : ''}
                  </div>
                </div>
              ))
          )}
        </aside>
      </div>

      {showFieldModal && editingField && (
        <div style={modalBg} onClick={(e) => e.target === e.currentTarget && setShowFieldModal(false)}>
          <div style={modal}>
            <h3 style={{ marginTop: 0 }}>Input Field</h3>
            <p style={{ color: '#666', fontSize: 12, marginTop: 0 }}>
              R{(pendingCell || editingField).row + 1}C{(pendingCell || editingField).col + 1}
            </p>
            <label style={lbl}>Label</label>
            <input autoFocus value={editingField.label}
              onChange={(e) => setEditingField({ ...editingField, label: e.target.value })}
              placeholder="e.g. Operator Name" style={inp} />
            <label style={lbl}>Type</label>
            <select value={editingField.type}
              onChange={(e) => setEditingField({ ...editingField, type: e.target.value })} style={inp}>
              {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', marginTop: 12, fontSize: 13 }}>
              <input type="checkbox" checked={!!editingField.required}
                onChange={(e) => setEditingField({ ...editingField, required: e.target.checked })}
                style={{ marginRight: 6 }} />
              Required
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={saveField} style={primaryBtn}>Save</button>
              {!pendingCell && (
                <button onClick={removeField} style={{ ...smallBtn, background: '#d93025' }}>Remove</button>
              )}
              <button onClick={() => setShowFieldModal(false)} style={{ ...smallBtn, background: '#888' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = { padding: '6px 14px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 };
const primaryBtn = { padding: '8px 16px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 14 };
const smallBtn = { padding: '6px 12px', background: '#888', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 };
const lbl = { display: 'block', fontSize: 12, color: '#555', marginBottom: 4, marginTop: 10 };
const inp = { width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14 };
const modalBg = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modal = { background: 'white', padding: 24, borderRadius: 10, width: 380, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' };
const fieldRow = { padding: '8px 10px', background: 'white', borderRadius: 4, marginBottom: 6, cursor: 'pointer', border: '1px solid #eee' };
