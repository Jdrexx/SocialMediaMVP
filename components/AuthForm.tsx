// @ts-nocheck
'use client';

import { useState } from 'react';
import { api } from './api';

const intentOptions = [
  ['friendship', 'Friendship'],
  ['peer_support', 'Peer support'],
  ['chat', 'Chat'],
  ['video_chat', 'Video chat'],
  ['romance', 'Romance'],
  ['resource_sharing', 'Resource sharing']
];

const experienceOptions = [
  ['trauma', 'Past trauma'],
  ['substance_recovery', 'Substance recovery'],
  ['mental_health_diversion', 'Mental health diversion'],
  ['loss_and_grief', 'Loss and grief'],
  ['social_challenges', 'Social challenges'],
  ['rehab_experience', 'Rehab experience'],
  ['court_navigation', 'Court navigation'],
  ['past_abuse', 'Past abusive relationship'],
  ['parent_or_caregiver', 'Parent or caregiver'],
  ['managed_mental_health', 'Managed mental health experience']
];

const initialAuth = {
  username: '', email: '', password: '', mfa_code: '',
  relationship_status: 'prefer_not_to_say',
  connection_intents: ['friendship'],
  experience_tags: [],
  city: '', region: '',
  age_18_plus: false,
  recovery_one_year: false,
  member_confidentiality: false,
  terms_accepted: false,
  privacy_accepted: false,
  not_medical_care: false
};

export default function AuthForm({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [auth, setAuth] = useState(initialAuth);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [status, setStatus] = useState('');

  function toggleArray(field, value) {
    setAuth((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value]
    }));
  }

  async function submitAuth(event) {
    event.preventDefault();
    setStatus('Working...');
    try {
      const path = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = mode === 'register'
        ? auth
        : { email: auth.email, password: auth.password, ...(mfaRequired ? { mfa_code: auth.mfa_code } : {}) };
      const data = await api(path, { method: 'POST', body: JSON.stringify(payload) });
      if (data.mfa_required) {
        setMfaRequired(true);
        setStatus(data.message);
        return;
      }
      onLogin(data.user, data.verification || null);
      setStatus(data.verification?.email_sent === false
        ? `Welcome to MySazz. Development verification token: ${data.verification.dev_token}`
        : 'Welcome to MySazz.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setMfaRequired(false);
    setStatus('');
  }

  return (
    <section className="card authCard">
      <div className="authIntro">
        <p className="eyebrow">Member access</p>
        <h2>{mode === 'login' ? 'Welcome back' : 'Bring your whole story'}</h2>
        <p>{mode === 'login' ? 'Sign in to reconnect with your MySazz community.' : 'Build friendships and peer connections at your pace, with privacy choices that stay in your hands.'}</p>
      </div>
      <div className="tabs">
        <button type="button" onClick={() => changeMode('login')} className={mode === 'login' ? 'active' : ''}>Log in</button>
        <button type="button" onClick={() => changeMode('register')} className={mode === 'register' ? 'active' : ''}>Join MySazz</button>
      </div>
      <form onSubmit={submitAuth} className="gridForm">
        {mode === 'register' && (
          <>
            <label>Member username
              <input value={auth.username} onChange={(event) => setAuth({ ...auth, username: event.target.value })} required minLength={3} autoComplete="username" />
            </label>
          </>
        )}
        <label>Email
          <input type="email" value={auth.email} onChange={(event) => setAuth({ ...auth, email: event.target.value })} required autoComplete="email" />
        </label>
        <label>Password
          <input type="password" value={auth.password} onChange={(event) => setAuth({ ...auth, password: event.target.value })} required minLength={8} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
        </label>

        {mode === 'login' && mfaRequired && (
          <label>Authenticator code
            <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={auth.mfa_code} onChange={(event) => setAuth({ ...auth, mfa_code: event.target.value })} required autoComplete="one-time-code" />
          </label>
        )}

        {mode === 'register' && (
          <div className="onboardingFields">
            <p className="formIntro">Share only what feels right. Experience tags are optional and hidden from other members until you choose to show them.</p>
            <label>Relationship status
              <select value={auth.relationship_status} onChange={(event) => setAuth({ ...auth, relationship_status: event.target.value })}>
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="single">Single</option>
                <option value="in_a_relationship">In a relationship</option>
                <option value="partnered">Partnered</option>
                <option value="married">Married</option>
              </select>
            </label>
            <fieldset>
              <legend>I’m here for</legend>
              <div className="choiceGrid">
                {intentOptions.map(([value, label]) => (
                  <label className="checkChoice" key={value}>
                    <input type="checkbox" checked={auth.connection_intents.includes(value)} onChange={() => toggleArray('connection_intents', value)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Experiences I may want to connect around (optional)</legend>
              <div className="choiceGrid">
                {experienceOptions.map(([value, label]) => (
                  <label className="checkChoice" key={value}>
                    <input type="checkbox" checked={auth.experience_tags.includes(value)} onChange={() => toggleArray('experience_tags', value)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="locationFields">
              <label>City (optional)<input value={auth.city} onChange={(event) => setAuth({ ...auth, city: event.target.value })} /></label>
              <label>State or region (optional)<input value={auth.region} onChange={(event) => setAuth({ ...auth, region: event.target.value })} /></label>
            </div>
            <div className="consentList">
              <label className="checkChoice"><input type="checkbox" checked={auth.age_18_plus} onChange={(event) => setAuth({ ...auth, age_18_plus: event.target.checked })} required /><span>I confirm that I am 18 or older.</span></label>
              <label className="checkChoice"><input type="checkbox" checked={auth.recovery_one_year} onChange={(event) => setAuth({ ...auth, recovery_one_year: event.target.checked })} required /><span>I self-attest that I have been moving forward in recovery for at least one year.</span></label>
              <label className="checkChoice"><input type="checkbox" checked={auth.member_confidentiality} onChange={(event) => setAuth({ ...auth, member_confidentiality: event.target.checked })} required /><span>I will respect member privacy and confidentiality.</span></label>
              <label className="checkChoice"><input type="checkbox" checked={auth.not_medical_care} onChange={(event) => setAuth({ ...auth, not_medical_care: event.target.checked })} required /><span>I understand MySazz does not replace therapy, medication, support groups, or professional care.</span></label>
              <label className="checkChoice"><input type="checkbox" checked={auth.terms_accepted} onChange={(event) => setAuth({ ...auth, terms_accepted: event.target.checked })} required /><span>I accept the <a href="/terms" target="_blank">Terms of Service</a>.</span></label>
              <label className="checkChoice"><input type="checkbox" checked={auth.privacy_accepted} onChange={(event) => setAuth({ ...auth, privacy_accepted: event.target.checked })} required /><span>I accept the <a href="/privacy" target="_blank">Privacy Policy</a>.</span></label>
            </div>
          </div>
        )}
        <button>{mode === 'register' ? 'Create MySazz account' : mfaRequired ? 'Verify and log in' : 'Log in'}</button>
      </form>
      <p className="status" role="status">{status}</p>
    </section>
  );
}
