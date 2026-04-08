import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function ApprovalRules() {
  const [templates, setTemplates] = useState([]);
  const [users, setUsers] = useState([]);
  const [rules, setRules] = useState({}); // templateId -> rule
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { templateId, required_count, approver_user_ids }
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const [{ templates }, { users }] = await Promise.all([
        api('/templates'),
        api('/users')
      ]);
      setTemplates(templates);
      setUsers(users);
      const ruleMap = {};
      await Promise.all(templates.map(async (t) => {
        const { rule } = await api(`/approvals/rules/${t.id}`);
        if (rule) ruleMap[t.id] = rule;
      }));
      setRules(ruleMap);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const startEdit = (template) => {
    const existing = rules[template.id];
    setEditing({
      templateId: template.id,
      templateName: template.name,
      required_count: existing?.required_count || 1,
      approver_user_ids: existing?.approver_user_ids || []
    });
  };

  const toggleApprover = (userId) => {
    setEditing(prev => {
      const has = prev.approver_user_ids.includes(userId);
      return {
        ...prev,
        approver_user_ids: has
          ? prev.approver_user_ids.filter(id => id !== userId)
          : [...prev.approver_user_ids, userId]
      };
    });
  };

  const saveRule = async () => {
    setError('');
    try {
      await api(`/approvals/rules/${editing.templateId}`, {
        method: 'PUT',
        body: JSON.stringify({
          required_count: editing.required_count,
          approver_user_ids: editing.approver_user_ids
        })
      });
      setEditing(null);
      refresh();
    } catch (e) { setError(e.message); }
  };

  const removeRule = async () => {
    if (!confirm('Remove the approval rule for this template?')) return;
    try {
      await api(`/approvals/rules/${editing.templateId}`, { method: 'DELETE' });
      setEditing(null);
      refresh();
    } catch (e) { setError(e.message); }
  };

  const nameFor = (id) => users.find(u => u.id === id)?.name || `User #${id}`;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Approval Rules</h2>
      {error && <div style={errBox}>{error}</div>}

      {loading ? <p>Loading...</p> : templates.length === 0 ? (
        <div style={emptyStyle}>
          <p style={{ color: '#666' }}>No templates yet. Upload one first.</p>
        </div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Template</th>
              <th style={th}>Rule</th>
              <th style={th}>Approvers</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(t => {
              const rule = rules[t.id];
              return (
                <tr key={t.id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={td}><strong>{t.name}</strong></td>
                  <td style={td}>
                    {rule ? `Any ${rule.required_count} of ${rule.approver_user_ids.length}` : <span style={{ color: '#d93025' }}>Not set</span>}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: '#555' }}>
                    {rule ? rule.approver_user_ids.map(nameFor).join(', ') : '—'}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => startEdit(t)} style={smallBtn}>
                      {rule ? 'Edit' : 'Set Rule'}
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
            <h3 style={{ marginTop: 0 }}>Approval Rule</h3>
            <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>{editing.templateName}</p>

            <label style={lbl}>Select approvers</label>
            <div style={{
              maxHeight: 200, overflow: 'auto', border: '1px solid #eee',
              borderRadius: 6, padding: 8
            }}>
              {users.filter(u => u.active).map(u => (
                <label key={u.id} style={{
                  display: 'flex', alignItems: 'center', padding: '6px 8px',
                  cursor: 'pointer', fontSize: 13
                }}>
                  <input
                    type="checkbox"
                    checked={editing.approver_user_ids.includes(u.id)}
                    onChange={() => toggleApprover(u.id)}
                    style={{ marginRight: 8 }}
                  />
                  <span>{u.name} <span style={{ color: '#888' }}>({u.email}, {u.role})</span></span>
                </label>
              ))}
            </div>

            <label style={lbl}>Required approvals (n of {editing.approver_user_ids.length || '—'})</label>
            <input
              type="number"
              min="1"
              max={editing.approver_user_ids.length || 1}
              value={editing.required_count}
              onChange={(e) => setEditing({ ...editing, required_count: Number(e.target.value) })}
              style={inp}
            />
            <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              Example: "Any 2 of 3" means 2 approvers (any of the {editing.approver_user_ids.length || '—'} selected) must approve.
            </p>

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={saveRule} style={primaryBtn}>Save Rule</button>
              {rules[editing.templateId] && (
                <button onClick={removeRule} style={{ ...smallBtn, background: '#d93025' }}>Remove Rule</button>
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
const modal = { background: 'white', padding: 24, borderRadius: 10, width: 440, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' };
