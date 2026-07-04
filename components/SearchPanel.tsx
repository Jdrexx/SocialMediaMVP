// @ts-nocheck
'use client';

import { useState } from 'react';
import { api } from './api';

export default function SearchPanel({ onSelectUser }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);

  async function doSearch(e) {
    e.preventDefault();
    setResults(await api(`/api/search?q=${encodeURIComponent(search)}`));
  }

  return (
    <section className="card searchPanel">
      <h2>Search</h2>
      <form onSubmit={doSearch} className="inline">
        <input
          placeholder="Search users or posts"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button>Go</button>
      </form>
      {results && (
        <div className="miniList">
          {results.users?.map((u) => (
            <button key={u.id} onClick={() => onSelectUser(u)}>
              @{u.username}
            </button>
          ))}
          {results.posts?.map((p) => (
            <article key={p.id}>{p.body}</article>
          ))}
        </div>
      )}
    </section>
  );
}
