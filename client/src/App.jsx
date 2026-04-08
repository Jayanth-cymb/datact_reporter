import React, { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Users from './pages/Users.jsx';
import Templates from './pages/Templates.jsx';
import TemplateEditor from './pages/TemplateEditor.jsx';
import Instances from './pages/Instances.jsx';
import InstanceFiller from './pages/InstanceFiller.jsx';
import Inbox from './pages/Inbox.jsx';
import ApprovalRules from './pages/ApprovalRules.jsx';
import Schedules from './pages/Schedules.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState({ name: 'dashboard' });

  useEffect(() => {
    const token = getToken();
    if (!token) { setReady(true); return; }
    api('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    setView({ name: 'dashboard' });
  };

  if (!ready) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!user) return <Login onLogin={setUser} />;

  const isAdmin = user.role === 'admin';
  const fullScreen = view.name === 'templateEditor' || view.name === 'instanceFiller';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'white', borderBottom: '1px solid #e0e0e0',
        padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 24
      }}>
        <strong style={{ fontSize: 17 }}>DatACT - Reporter</strong>
        <nav style={{ display: 'flex', gap: 6 }}>
          <NavBtn active={view.name === 'dashboard'} onClick={() => setView({ name: 'dashboard' })}>Dashboard</NavBtn>
          <NavBtn active={view.name === 'instances' || view.name === 'instanceFiller'} onClick={() => setView({ name: 'instances' })}>My Check Sheets</NavBtn>
          <NavBtn active={view.name === 'inbox'} onClick={() => setView({ name: 'inbox' })}>Inbox</NavBtn>
          <NavBtn active={view.name === 'templates' || view.name === 'templateEditor'} onClick={() => setView({ name: 'templates' })}>Templates</NavBtn>
          {isAdmin && (
            <>
              <NavBtn active={view.name === 'rules'} onClick={() => setView({ name: 'rules' })}>Approval Rules</NavBtn>
              <NavBtn active={view.name === 'schedules'} onClick={() => setView({ name: 'schedules' })}>Schedules</NavBtn>
              <NavBtn active={view.name === 'users'} onClick={() => setView({ name: 'users' })}>Users</NavBtn>
            </>
          )}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#555' }}>
            {user.name} ({user.role})
          </span>
          <button onClick={logout} style={{
            padding: '6px 14px', background: '#f1f3f4', color: '#222',
            border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 13
          }}>Sign out</button>
        </div>
      </header>
      <main style={fullScreen ? { flex: 1, minHeight: 0 } : { flex: 1, padding: 24, maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        {view.name === 'dashboard' && (
          <Dashboard
            user={user}
            onOpenInstance={(id) => setView({ name: 'instanceFiller', id })}
            goInbox={() => setView({ name: 'inbox' })}
            goInstances={() => setView({ name: 'instances' })}
          />
        )}
        {view.name === 'users' && isAdmin && <Users />}
        {view.name === 'templates' && (
          <Templates user={user} onOpen={(id) => setView({ name: 'templateEditor', id })} />
        )}
        {view.name === 'templateEditor' && (
          <TemplateEditor id={view.id} user={user} onBack={() => setView({ name: 'templates' })} />
        )}
        {view.name === 'instances' && (
          <Instances user={user} onOpen={(id) => setView({ name: 'instanceFiller', id })} />
        )}
        {view.name === 'instanceFiller' && (
          <InstanceFiller id={view.id} user={user} onBack={() => setView({ name: 'instances' })} />
        )}
        {view.name === 'inbox' && (
          <Inbox onOpen={(id) => setView({ name: 'instanceFiller', id })} />
        )}
        {view.name === 'rules' && isAdmin && <ApprovalRules />}
        {view.name === 'schedules' && isAdmin && <Schedules />}
      </main>
    </div>
  );
}

function NavBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', background: active ? '#e8f0fe' : 'transparent',
      color: active ? '#1a73e8' : '#444', border: 'none', borderRadius: 4,
      cursor: 'pointer', fontSize: 14, fontWeight: active ? 600 : 400
    }}>{children}</button>
  );
}
