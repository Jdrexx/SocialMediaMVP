'use client';

import Avatar from './Avatar.jsx';
import { api } from './api.js';

export default function ProfileCard({ user, onUserUpdate }) {
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
    </section>
  );
}
