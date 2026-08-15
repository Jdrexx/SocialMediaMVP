// @ts-nocheck
'use client';

import { useState } from 'react';
import Avatar from './Avatar';
import { api } from './api';

const intentOptions = ['friendship', 'peer_support', 'chat', 'video_chat', 'romance', 'resource_sharing'];
const experienceOptions = ['trauma', 'substance_recovery', 'mental_health_diversion', 'loss_and_grief', 'social_challenges', 'rehab_experience', 'court_navigation', 'past_abuse', 'parent_or_caregiver', 'managed_mental_health'];
const label = (value) => value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());

export default function ProfileCard({ user, onUserUpdate }) {
  const profile = user.member_profile || {};
  const [editMode, setEditMode] = useState(false);
  const [profileForm, setProfileForm] = useState({
    bio: user.bio || '',
    relationship_status: profile.relationship_status || 'prefer_not_to_say',
    connection_intents: profile.connection_intents || ['friendship'],
    experience_tags: profile.experience_tags || [],
    city: profile.city || '', region: profile.region || '', postal_code: profile.postal_code || '',
    search_radius_miles: profile.search_radius_miles || 25,
    discoverable: profile.discoverable ?? true,
    show_relationship_status: profile.show_relationship_status ?? false,
    show_experience_tags: profile.show_experience_tags ?? false,
    presence_status: profile.presence_status || 'offline'
  });
  const [status, setStatus] = useState('');
  const [pwMode, setPwMode] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '' });
  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaDisable, setMfaDisable] = useState({ password: '', code: '' });
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ password: '', confirmation: '' });

  function toggleArray(field, value) {
    setProfileForm((current) => ({
      ...current,
      [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : [...current[field], value]
    }));
  }

  async function uploadFile(file) {
    const form = new FormData();
    form.append('media', file);
    return api('/api/uploads', { method: 'POST', body: form });
  }

  async function setProfileImage(kind, file) {
    try {
      setStatus(`Uploading ${kind}...`);
      const uploaded = await uploadFile(file);
      const data = await api(`/api/me/${kind}`, { method: 'POST', body: JSON.stringify({ media_id: uploaded.media.id }) });
      onUserUpdate(data.user);
      setStatus('Profile image updated.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setStatus('Saving profile...');
    try {
      const data = await api('/api/me', { method: 'PATCH', body: JSON.stringify(profileForm) });
      onUserUpdate(data.user);
      setEditMode(false);
      setStatus('Profile saved.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setStatus('Changing password...');
    try {
      await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(pwForm) });
      setStatus('Password changed.');
      setPwMode(false);
      setPwForm({ current_password: '', new_password: '' });
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function startMfa() {
    try {
      const data = await api('/api/auth/2fa/setup', { method: 'POST' });
      setMfaSetup(data);
      setStatus('Add the secret to your authenticator app, then confirm a code.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function confirmMfa(event) {
    event.preventDefault();
    try {
      const data = await api('/api/auth/2fa/confirm', { method: 'POST', body: JSON.stringify({ code: mfaCode }) });
      onUserUpdate(data.user);
      setMfaSetup(null);
      setMfaCode('');
      setStatus('Two-factor authentication enabled.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function disableMfa(event) {
    event.preventDefault();
    try {
      await api('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify(mfaDisable) });
      onUserUpdate({ ...user, two_factor_enabled: false });
      setMfaDisable({ password: '', code: '' });
      setStatus('Two-factor authentication disabled.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function deleteAccount(event) {
    event.preventDefault();
    try {
      await api('/api/me', { method: 'DELETE', body: JSON.stringify(deleteForm) });
      window.location.assign('/');
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="card profilePanel">
      <div className="cover">{user.cover_url && <img src={user.cover_url} alt="Profile cover" />}</div>
      <Avatar user={user} size={72} />
      <div>
        <h2>@{user.username}</h2>
        <span className={`presence presence-${profile.presence_status || 'offline'}`}>{label(profile.presence_status || 'offline')}</span>
      </div>
      <p>{user.bio || 'Tell the community a little about yourself.'}</p>
      {(profile.city || profile.region) && <p className="profileMeta">{[profile.city, profile.region].filter(Boolean).join(', ')}</p>}
      <div className="tagList">{(profile.connection_intents || []).map((item) => <span key={item}>{label(item)}</span>)}</div>

      {!editMode ? <button className="secondaryButton" onClick={() => setEditMode(true)}>Edit member profile</button> : (
        <form onSubmit={saveProfile} className="gridForm profileEditForm">
          <label>Bio<textarea maxLength={240} value={profileForm.bio} onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })} /></label>
          <label>Presence
            <select value={profileForm.presence_status} onChange={(event) => setProfileForm({ ...profileForm, presence_status: event.target.value })}>
              <option value="available">Available to chat</option><option value="busy">Busy</option><option value="offline">Offline</option>
            </select>
          </label>
          <label>Relationship status
            <select value={profileForm.relationship_status} onChange={(event) => setProfileForm({ ...profileForm, relationship_status: event.target.value })}>
              {['prefer_not_to_say', 'single', 'in_a_relationship', 'partnered', 'married'].map((item) => <option key={item} value={item}>{label(item)}</option>)}
            </select>
          </label>
          <fieldset><legend>Connection interests</legend><div className="choiceGrid compactChoices">{intentOptions.map((item) => <label className="checkChoice" key={item}><input type="checkbox" checked={profileForm.connection_intents.includes(item)} onChange={() => toggleArray('connection_intents', item)} /><span>{label(item)}</span></label>)}</div></fieldset>
          <fieldset><legend>Lived-experience tags</legend><div className="choiceGrid compactChoices">{experienceOptions.map((item) => <label className="checkChoice" key={item}><input type="checkbox" checked={profileForm.experience_tags.includes(item)} onChange={() => toggleArray('experience_tags', item)} /><span>{label(item)}</span></label>)}</div></fieldset>
          <div className="locationFields"><label>City<input value={profileForm.city} onChange={(event) => setProfileForm({ ...profileForm, city: event.target.value })} /></label><label>State or region<input value={profileForm.region} onChange={(event) => setProfileForm({ ...profileForm, region: event.target.value })} /></label></div>
          <label>Private ZIP or postal code<input value={profileForm.postal_code} onChange={(event) => setProfileForm({ ...profileForm, postal_code: event.target.value })} /><small>Used for future resource search; never shown to members.</small></label>
          <label>Search radius: {profileForm.search_radius_miles} miles<input type="range" min="1" max="100" value={profileForm.search_radius_miles} onChange={(event) => setProfileForm({ ...profileForm, search_radius_miles: Number(event.target.value) })} /></label>
          <label className="checkChoice"><input type="checkbox" checked={profileForm.discoverable} onChange={(event) => setProfileForm({ ...profileForm, discoverable: event.target.checked })} /><span>Let members find my profile</span></label>
          <label className="checkChoice"><input type="checkbox" checked={profileForm.show_relationship_status} onChange={(event) => setProfileForm({ ...profileForm, show_relationship_status: event.target.checked })} /><span>Show relationship status</span></label>
          <label className="checkChoice"><input type="checkbox" checked={profileForm.show_experience_tags} onChange={(event) => setProfileForm({ ...profileForm, show_experience_tags: event.target.checked })} /><span>Show experience tags</span></label>
          <div className="inline"><button>Save profile</button><button type="button" className="secondaryButton" onClick={() => setEditMode(false)}>Cancel</button></div>
        </form>
      )}

      <details>
        <summary>Photos and account security</summary>
        <div className="gridForm detailsBody">
          <label>Profile photo<input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && setProfileImage('avatar', event.target.files[0])} /></label>
          <label>Cover image<input type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && setProfileImage('cover', event.target.files[0])} /></label>
          {!pwMode ? <button className="secondaryButton" onClick={() => setPwMode(true)}>Change password</button> : (
            <form onSubmit={changePassword} className="gridForm"><input type="password" placeholder="Current password" value={pwForm.current_password} onChange={(event) => setPwForm({ ...pwForm, current_password: event.target.value })} required /><input type="password" placeholder="New password (8+ characters)" value={pwForm.new_password} onChange={(event) => setPwForm({ ...pwForm, new_password: event.target.value })} required minLength={8} /><button>Save password</button></form>
          )}
          {!user.two_factor_enabled && !mfaSetup && <button className="secondaryButton" onClick={startMfa}>Enable authenticator 2FA</button>}
          {user.two_factor_enabled && <form className="gridForm" onSubmit={disableMfa}><p className="securityGood">Authenticator 2FA is enabled.</p><input type="password" placeholder="Password to disable 2FA" value={mfaDisable.password} onChange={(event) => setMfaDisable({ ...mfaDisable, password: event.target.value })} required /><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="Current six-digit code" value={mfaDisable.code} onChange={(event) => setMfaDisable({ ...mfaDisable, code: event.target.value })} required /><button className="secondaryButton">Disable 2FA</button></form>}
          {mfaSetup && <form className="gridForm" onSubmit={confirmMfa}><p>Authenticator secret: <code>{mfaSetup.secret}</code></p><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="Six-digit code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} required /><button>Confirm 2FA</button></form>}
          <button className="secondaryButton" onClick={() => window.location.assign('/api/me/export')}>Download my data</button>
          {!deleteMode ? <button className="danger" onClick={() => setDeleteMode(true)}>Delete my account</button> : <form className="gridForm dangerZone" onSubmit={deleteAccount}><strong>Permanent account deletion</strong><input type="password" placeholder="Password" value={deleteForm.password} onChange={(event) => setDeleteForm({ ...deleteForm, password: event.target.value })} required /><input placeholder="Type DELETE" value={deleteForm.confirmation} onChange={(event) => setDeleteForm({ ...deleteForm, confirmation: event.target.value })} required /><button className="danger">Permanently delete account</button></form>}
        </div>
      </details>
      <p className="status" role="status">{status}</p>
    </section>
  );
}
