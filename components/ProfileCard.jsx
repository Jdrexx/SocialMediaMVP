'use client';

import { useState } from 'react';
import Avatar from './Avatar.jsx';
import { api } from './api.js';

export default function ProfileCard({ user, onUserUpdate, onBlockUser }) {
  const [pwMode, setPwMode] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '' });
  const [pwStatus, setPwStatus] = useState('');

  async function uploadFile(file) {
    const form = new FormData();
    form.append('media', file);
    return api('/api/uploads', { method: 'POST', body: form });
  }

  async function setProfileImage(kind, file) {
    const uploaded = await uploadFile(file);
    const data = await api(`/api/me/${kind}`, {
      method: 'POST',
      body: JSON.stringify({ media_id: uploaded.media.id })
    });
    onUserUpdate(data.user);
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwStatus('Working...');
    try {
      await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(pwForm) });
      setPwStatus('Password changed');
      setPwMode(false);
      setPwForm({ current_password: '', new_password: '' });
    } catch (err) {
      setPwStatus(err.message);
    }
  }

  return (
    <section className="card profilePanel">
      <div className="cover">
        {user.cover_url && <img src={user.cover_url} alt="cover" />}
      </div>
      <Avatar user={user} size={72} />
      <h2>@{user.username}</h2>
      <p>{user.bio || 'Add a bio from the legacy profile screen or API.'}</p>
      <label>
        Profile photo
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && setProfileImage('avatar', e.target.files[0])} />
      </label>
      <label>
        Cover image
        <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && setProfileImage('cover', e.target.files[0])} />
      </label>
      {!pwMode ? (
        <button className="secondaryButton" onClick={() => setPwMode(true)}>Change password</button>
      ) : (
        <form onSubmit={changePassword} className="gridForm" style={{ marginTop: '.5rem' }}>
          <input type="password" placeholder="Current password" value={pwForm.current_password}
            onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} required />
          <input type="password" placeholder="New password (8+ chars)" value={pwForm.new_password}
            onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} required minLength={8} />
          <div className="inline">
            <button type="submit">Save</button>
            <button type="button" className="secondaryButton" onClick={() => { setPwMode(false); setPwStatus(''); }}>Cancel</button>
          </div>
          <p className="status">{pwStatus}</p>
        </form>
      )}
    </section>
  );
}
