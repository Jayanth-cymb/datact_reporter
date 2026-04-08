import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const STATUS_META = {
  overdue:  { label: 'Overdue',  bg: '#d93025', text: 'white' },
  draft:    { label: 'In Progress', bg: '#888', text: 'white' },
  pending:  { label: 'Awaiting Approval', bg: '#e8a317', text: 'white' },
  approved: { label: 'Completed', bg: '#2e9e4d', text: 'white' },
  rejected: { label: 'Rejected', bg: '#d93025', text: 'white' }
};

export default function Dashboard({ user, onOpenInstance, onStartFromTemplate, goInbox, goInstances }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const resp = await api('/dashboard/overview');
      setData(resp);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30000); // auto-refresh every 30s
    return () => clearInterval(t);
  }, []);

  const handleScheduleClick = async (item) => {
    if (item.instance_id) {
      onOpenInstance(item.instance_id);
    } else {
      // Overdue — create a new instance for this template
      try {
        const { id } = await api('/instances', {
          method: 'POST',
          body: JSON.stringify({ template_id: item.template_id })
        });
        onOpenInstance(id);
      } catch (e) { setError(e.message); }
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <div style={errBox}>{error}</div>;
  if (!data) return null;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Dashboard</h2>
      <p style={{ color: '#666', marginTop: -8 }}>
        Welcome, {user.name}. Here's what's happening now.
      </p>

      <div style={statsRow}>
        <StatCard label="Overdue" value={data.counts.overdue} color="#d93025" onClick={() => {}} />
        <StatCard label="In Approval Inbox" value={data.counts.inbox} color="#e8a317" onClick={goInbox} />
        <StatCard label="My Drafts" value={data.counts.my_drafts} color="#888" onClick={goInstances} />
        <StatCard label="My Submitted" value={data.counts.my_submitted} color="#1a73e8" onClick={goInstances} />
      </div>

      <h3 style={{ marginTop: 30, marginBottom: 12 }}>Scheduled Check Sheets</h3>
      {data.schedules.length === 0 ? (
        <div style={emptyStyle}>
          <p style={{ color: '#888' }}>No scheduled check sheets yet. Admins can add schedules from the <strong>Schedules</strong> page.</p>
        </div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>Template</th>
              <th style={th}>Period Started</th>
              <th style={th}>Next Due</th>
              <th style={th}>Status</th>
              <th style={{ ...th, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.schedules.map(s => {
              const meta = STATUS_META[s.period_status] || STATUS_META.overdue;
              return (
                <tr key={s.template_id} style={{ borderTop: '1px solid #eee' }}>
                  <td style={td}><strong>{s.template_name}</strong></td>
                  <td style={td}>{new Date(s.period_start).toLocaleString()}</td>
                  <td style={td}>{new Date(s.next_due).toLocaleString()}</td>
                  <td style={td}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 12,
                      background: meta.bg, color: meta.text, fontSize: 11,
                      fontWeight: 600, textTransform: 'uppercase'
                    }}>{meta.label}</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button onClick={() => handleScheduleClick(s)} style={primaryBtn}>
                      {s.period_status === 'overdue' ? 'Start Now' : 'Open'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatCard({ label, value, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      flex: 1, background: 'white', borderRadius: 10,
      padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      cursor: onClick ? 'pointer' : 'default',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4, color: '#222' }}>{value}</div>
    </div>
  );
}

const statsRow = { display: 'flex', gap: 14, marginTop: 20 };
const tableStyle = { width: '100%', background: 'white', borderCollapse: 'collapse', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' };
const th = { textAlign: 'left', padding: '12px 16px', fontSize: 12, textTransform: 'uppercase', color: '#666', background: '#f5f5f5', fontWeight: 600 };
const td = { padding: '14px 16px', fontSize: 14 };
const primaryBtn = { padding: '6px 14px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 };
const errBox = { background: '#fce8e6', color: '#a50e0e', padding: '10px 14px', borderRadius: 6, marginBottom: 14, fontSize: 13 };
const emptyStyle = { textAlign: 'center', padding: '40px 20px', background: 'white', borderRadius: 8, border: '1px dashed #ddd' };
