// @ts-nocheck
'use client';

import { useState } from 'react';
import { api } from '../../components/api';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  async function submit(event) {
    event.preventDefault();
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) return setStatus('This reset link is missing its token.');
    try {
      await api('/api/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, password }) });
      setStatus('Password changed. Return to MySazz to sign in.');
    } catch (error) { setStatus(error.message); }
  }
  return <main className="shell infoPage"><a className="backLink" href="/">← Back to MySazz</a><section className="card authCard"><p className="eyebrow">Account security</p><h1>Reset password</h1><form className="gridForm" onSubmit={submit}><label>New password<input type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button>Save new password</button></form><p role="status">{status}</p></section></main>;
}
