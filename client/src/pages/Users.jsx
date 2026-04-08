import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const ROLES = ['admin', 'operator', 'approver'];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const { users } = await api('/users');
      setUsers(users);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const startCreate = () => { setEditing({ email: '', name: '', password: '', role: 'operator' }); setShowForm(true); };
  const startEdit = (u) => { setEditing({ ...u, password: '' }); setShowForm(true); };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing.id) {
        const body = { name: editing.name, role: editing.role, active: editing.active };
        if (editing.password) body.password = editing.password;
        await api(`/users/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await api('/users', { method: 'POST', body: JSON.stringify(editing) });
      }
      setShowForm(false);
      setEditing(null);
      refresh();
    } catch (err) { setError(err.message); }
  };

  const remove = async (u) => {
    if (!confirm(`Delete ${u.email}?`)) return;
    try {
      await api(`/users/${u.id}`, { method: 'DELETE' });
      refresh();
    } catch (err) { setError(err.message); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>Users</h2>
        <button onClick={startCreate} style={primaryBtn}>+ New User</button>
      </div>

      {error && <div style={errBox}>{error}</div>}

      {loading ? <p>Loading...</p> : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Email</th>
              <th style={th}>Name</th>
              <th style={th}>Role</th>
              <th style={th}>Active</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={td}>{u.email}</td>
                <td style={td}>{u.name}</td>
                <td style={td}><span style={roleBadge(u.role)}>{u.role}</span></td>
                <td style={td}>{u.active ? 'Yes' : 'No'}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button onClick={() => startEdit(u)} style={smallBtn}>Edit</button>
                  <button onClick={() => remove(u)} style={{ ...smallBtn, background: '#888' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <div style={modalBg} onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <form onSubmit={save} style={modal}>
            <h3 style={{ marginTop: 0 }}>{editing.id ? 'Edit User' : 'New User'}</h3>
            <label style={lbl}>Email</label>
            <input type="email" value={editing.email} required disabled={!!editing.id}
              onChange={(e) => setEditing({ ...editing, email: e.target.value })} style={inp} />
            <label style={lbl}>Name</label>
            <input value={editing.name} required
              onChange={(e) => setEditing({ ...editing, name: e.target.value })} style={inp} />
            <label style={lbl}>Role</label>
            <select value={editing.role}
              onChange={(e) => setEditing({ ...editing, role: e.target.value })} style={inp}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <label style={lbl}>{editing.id ? 'New Password (leave blank to keep)' : 'Password'}</label>
            <input type="password" value={editing.password}
              onChange={(e) => setEditing({ ...editing, password: e.target.value })}
              required={!editing.id} style={inp} />
            {editing.id && (
              <label style={{ display: 'flex', alignItems: 'center', marginTop: 12, fontSize: 13 }}>
                <input type="checkbox" checked={!!editing.active}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  style={{ marginRight: 6 }} />
                Active
              </label>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button type="submit" style={primaryBtn}>Save</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ ...smallBtn, background: '#888' }}>Cancel</button>
            </div>
          </form>
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
const modalBg = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const modal = { background: 'white', padding: 24, borderRadius: 10, width: 380, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' };

function roleBadge(role) {
  const colors = { admin: '#1a73e8', operator: '#2e9e4d', approver: '#e8a317' };
  return {
    display: 'inline-block', padding: '3px 10px', borderRadius: 12, color: 'white',
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', background: colors[role] || '#888'
  };
}
