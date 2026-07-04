'use client';

import { useState } from 'react';
import { api } from './api.js';

export default function AuthForm({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [auth, setAuth] = useState({ username: '', email: '', password: '' });
  const [status, setStatus] = useState('');

  async function submitAuth(e) {
    e.preventDefault();
    setStatus('Working...');
    try {
      const path = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = mode === 'register' ? auth : { email: auth.email, password: auth.password };
      const data = await api(path, { method: 'POST', body: JSON.stringify(payload) });
      onLogin(data.user);
      setStatus(data.verification?.email_sent === false
        ? `Signed in. Dev verify token: ${data.verification.dev_token}`
        : 'Signed in.');
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <section className="card authCard">
      <div className="tabs">
        <button onClick={() => setMode('login')} className={mode === 'login' ? 'active' : ''}>Login</button>
        <button onClick={() => setMode('register')} className={mode === 'register' ? 'active' : ''}>Register</button>
      </div>
      <form onSubmit={submitAuth} className="gridForm">
        {mode === 'register' && (
          <input
            placeholder="Username"
            value={auth.username}
            onChange={(e) => setAuth({ ...auth, username: e.target.value })}
          />
        )}
        <input
          placeholder="Email"
          value={auth.email}
          onChange={(e) => setAuth({ ...auth, email: e.target.value })}
        />
        <input
          placeholder="Password"
          type="password"
          value={auth.password}
          onChange={(e) => setAuth({ ...auth, password: e.target.value })}
        />
        <button>{mode === 'register' ? 'Create account' : 'Login'}</button>
      </form>
      <p className="status">{status}</p>
    </section>
  );
}
