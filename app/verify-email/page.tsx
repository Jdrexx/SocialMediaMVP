// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { api } from '../../components/api';

export default function VerifyEmailPage() {
  const [status, setStatus] = useState('Verifying your email...');
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) return setStatus('This verification link is missing its token.');
    api('/api/auth/email-verification/confirm', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => setStatus('Email verified. You can return to MySazz and sign in.'))
      .catch((error) => setStatus(error.message));
  }, []);
  return <main className="shell infoPage"><a className="backLink" href="/">← Back to MySazz</a><section className="card authCard"><p className="eyebrow">Account security</p><h1>Email verification</h1><p role="status">{status}</p></section></main>;
}
