// @ts-nocheck
'use client';

import { useCallback, useEffect, useState } from 'react';
import Avatar from './Avatar';
import { api } from './api';

const label = (value) => value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());

export default function SearchPanel({ onSelectUser }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ users: [], posts: [] });
  const [connections, setConnections] = useState({ accepted: [], incoming: [], outgoing: [] });
  const [status, setStatus] = useState('');

  const loadConnections = useCallback(async () => {
    const data = await api('/api/connections');
    setConnections(data);
  }, []);

  useEffect(() => { loadConnections().catch(() => null); }, [loadConnections]);

  async function search(event) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    try {
      setResults(await api(`/api/search?q=${encodeURIComponent(query.trim())}`));
      setStatus('');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function requestConnection(member) {
    try {
      await api(`/api/connections/${encodeURIComponent(member.username)}/request`, { method: 'POST' });
      setResults((current) => ({ ...current, users: current.users.map((item) => item.id === member.id ? { ...item, connection_status: 'outgoing_pending' } : item) }));
      await loadConnections();
      setStatus(`Connection request sent to @${member.username}.`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function respond(connection, action) {
    try {
      await api(`/api/connections/${connection.id}/respond`, { method: 'POST', body: JSON.stringify({ action }) });
      await loadConnections();
      setStatus(action === 'accept' ? `You and @${connection.member.username} are now connected.` : 'Request declined.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="card searchPanel">
      <h2>Connections</h2>
      {connections.incoming.length > 0 && <div className="connectionGroup"><strong>Requests for you</strong>{connections.incoming.map((connection) => <article className="connectionRow" key={connection.id}><Avatar user={connection.member} size={36} /><span>@{connection.member.username}</span><button onClick={() => respond(connection, 'accept')}>Accept</button><button className="secondaryButton" onClick={() => respond(connection, 'decline')}>Decline</button></article>)}</div>}
      {connections.accepted.length > 0 && <div className="connectionGroup"><strong>Your connections</strong>{connections.accepted.map((connection) => <button className="memberResult" key={connection.id} onClick={() => onSelectUser(connection.member)}><Avatar user={connection.member} size={36} /><span>@{connection.member.username}<small>Message or video chat</small></span></button>)}</div>}
      <form onSubmit={search} className="inline">
        <input placeholder="Search members, city, interests..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <button>Find</button>
      </form>
      <div className="miniList">
        {results.users.map((member) => (
          <article className="memberSearchResult" key={member.id}>
            <div className="memberIdentity"><Avatar user={member} size={40} /><span><strong>@{member.username}</strong><small>{[member.member_profile?.city, member.member_profile?.region].filter(Boolean).join(', ') || 'Location not shared'}</small></span></div>
            <p>{member.bio}</p>
            <div className="tagList">{(member.member_profile?.connection_intents || []).map((intent) => <span key={intent}>{label(intent)}</span>)}</div>
            {member.connection_status === 'connected'
              ? <button onClick={() => onSelectUser(member)}>Message</button>
              : member.connection_status === 'outgoing_pending'
                ? <button disabled>Request pending</button>
                : member.connection_status === 'incoming_pending'
                  ? <span className="status">Review this request above.</span>
                  : <button onClick={() => requestConnection(member)}>Request connection</button>}
          </article>
        ))}
        {results.posts.length > 0 && <p className="status">{results.posts.length} matching member stories found in the community feed.</p>}
      </div>
      <p className="status" role="status">{status}</p>
    </section>
  );
}
