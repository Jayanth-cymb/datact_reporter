import React, { useState } from 'react';
import { api, setToken } from '../api.js';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@datact.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      setToken(token);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <form onSubmit={submit} style={{
        background: 'white', padding: 32, borderRadius: 10, width: 360,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>DatACT - Reporter</h1>
        <p style={{ margin: '0 0 24px', color: '#777', fontSize: 13 }}>Sign in to continue</p>

        <label style={lbl}>Email</label>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          required style={inp}
        />

        <label style={lbl}>Password</label>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          required style={inp}
        />

        {error && <div style={{ color: '#d93025', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button type="submit" disabled={loading} style={btn}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

const lbl = { display: 'block', fontSize: 12, color: '#555', marginBottom: 4, marginTop: 10 };
const inp = {
  width: '100%', padding: '9px 12px', border: '1px solid #ddd',
  borderRadius: 6, fontSize: 14, marginBottom: 4
};
const btn = {
  width: '100%', padding: '10px', background: '#1a73e8', color: 'white',
  border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500,
  cursor: 'pointer', marginTop: 16
};
