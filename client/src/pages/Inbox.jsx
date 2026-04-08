import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Inbox({ onOpen }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const { inbox } = await api('/approvals/inbox');
      setItems(inbox);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Approval Inbox</h2>
      {error && <div style={errBox}>{error}</div>}

      {loading ? <p>Loading...</p> : items.length === 0 ? (
        <div style={emptyStyle}>
          <p style={{ color: '#666', fontSize: 15 }}>Nothing waiting for your approval</p>
        </div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Template</th>
              <th style={th}>Submitted By</th>
              <th style={th}>Submitted At</th>
              <th style={th}>Progress</th>
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
                <td style={td}>{it.created_by_name}</td>
                <td style={td}>{new Date(it.submitted_at).toLocaleString()}</td>
                <td style={td}>
                  <span style={progressBadge}>
                    {it.approved_count} / {it.required_count}
                  </span>
                </td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button onClick={() => onOpen(it.id)} style={smallBtn}>Review</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const tableStyle = { width: '100%', background: 'white', borderCollapse: 'collapse', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' };
const th = { textAlign: 'left', padding: '12px 16px', fontSize: 12, textTransform: 'uppercase', color: '#666', background: '#f5f5f5', fontWeight: 600 };
const td = { padding: '14px 16px', fontSize: 14 };
const smallBtn = { padding: '6px 12px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 };
const errBox = { background: '#fce8e6', color: '#a50e0e', padding: '10px 14px', borderRadius: 6, marginBottom: 14, fontSize: 13 };
const emptyStyle = { textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: 8, border: '1px dashed #ddd' };
const progressBadge = {
  display: 'inline-block', padding: '3px 10px', borderRadius: 12,
  background: '#e8f0fe', color: '#1a73e8', fontSize: 12, fontWeight: 600
};
