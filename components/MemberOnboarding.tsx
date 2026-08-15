// @ts-nocheck
'use client';

import { useState } from 'react';
import { api } from './api';

const initial = {
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

export default function MemberOnboarding({ onComplete }) {
  const [form, setForm] = useState(initial);
  const [status, setStatus] = useState('');

  async function submit(event) {
    event.preventDefault();
    setStatus('Saving your choices...');
    try {
      const data = await api('/api/me/onboarding', { method: 'POST', body: JSON.stringify(form) });
      onComplete(data.user);
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="card authCard">
      <p className="eyebrow">A safer community starts here</p>
      <h2>Complete your MySazz membership</h2>
      <p className="formIntro">We updated our membership commitments. Please review and accept them before continuing.</p>
      <form className="gridForm" onSubmit={submit}>
        <label>Relationship status
          <select value={form.relationship_status} onChange={(event) => setForm({ ...form, relationship_status: event.target.value })}>
            <option value="prefer_not_to_say">Prefer not to say</option>
            <option value="single">Single</option>
            <option value="in_a_relationship">In a relationship</option>
            <option value="partnered">Partnered</option>
            <option value="married">Married</option>
          </select>
        </label>
        <label>Primary reason for joining
          <select value={form.connection_intents[0]} onChange={(event) => setForm({ ...form, connection_intents: [event.target.value] })}>
            <option value="friendship">Friendship</option>
            <option value="peer_support">Peer support</option>
            <option value="chat">Chat</option>
            <option value="video_chat">Video chat</option>
            <option value="romance">Romance</option>
            <option value="resource_sharing">Resource sharing</option>
          </select>
        </label>
        <div className="locationFields">
          <label>City (optional)<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
          <label>State or region (optional)<input value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} /></label>
        </div>
        <div className="consentList">
          <label className="checkChoice"><input type="checkbox" required checked={form.age_18_plus} onChange={(event) => setForm({ ...form, age_18_plus: event.target.checked })} /><span>I confirm that I am 18 or older.</span></label>
          <label className="checkChoice"><input type="checkbox" required checked={form.recovery_one_year} onChange={(event) => setForm({ ...form, recovery_one_year: event.target.checked })} /><span>I self-attest to at least one year of positive recovery progress.</span></label>
          <label className="checkChoice"><input type="checkbox" required checked={form.member_confidentiality} onChange={(event) => setForm({ ...form, member_confidentiality: event.target.checked })} /><span>I will protect member privacy and confidentiality.</span></label>
          <label className="checkChoice"><input type="checkbox" required checked={form.not_medical_care} onChange={(event) => setForm({ ...form, not_medical_care: event.target.checked })} /><span>MySazz does not replace professional care.</span></label>
          <label className="checkChoice"><input type="checkbox" required checked={form.terms_accepted} onChange={(event) => setForm({ ...form, terms_accepted: event.target.checked })} /><span>I accept the <a href="/terms" target="_blank">Terms of Service</a>.</span></label>
          <label className="checkChoice"><input type="checkbox" required checked={form.privacy_accepted} onChange={(event) => setForm({ ...form, privacy_accepted: event.target.checked })} /><span>I accept the <a href="/privacy" target="_blank">Privacy Policy</a>.</span></label>
        </div>
        <button>Complete membership</button>
      </form>
      <p className="status" role="status">{status}</p>
    </section>
  );
}
