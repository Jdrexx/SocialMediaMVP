'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../components/api.js';

function StatCard({ label, value }) {
  return (
    <div className="statCard">
      <strong>{value ?? '—'}</strong>
      <span>{label}</span>
    </div>
  );
}

function AdminTabs({ tabs, active, onChange }) {
  return (
    <div className="adminTabs">
      {tabs.map((t) => (
        <button key={t.key} className={active === t.key ? 'active' : ''} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [log, setLog] = useState([]);
  const [tab, setTab] = useState('stats');
  const [userSearch, setUserSearch] = useState('');
  const [postSearch, setPostSearch] = useState('');
  const [postFilter, setPostFilter] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [selectedPosts, setSelectedPosts] = useState(new Set());

  const loadStats = useCallback(async () => {
    try { setStats(await api('/api/admin/stats')); } catch { setStats(null); }
  }, []);

  const loadUsers = useCallback(async () => {
    try { setUsers((await api('/api/admin/users')).users); } catch { setUsers([]); }
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (postFilter) params.set('hidden', postFilter);
      if (postSearch) params.set('q', postSearch);
      setPosts((await api(`/api/admin/posts?${params}`)).posts);
    } catch { setPosts([]); }
  }, [postFilter, postSearch]);

  const loadReports = useCallback(async () => {
    try { setReports((await api('/api/admin/reports')).reports); } catch { setReports([]); }
  }, []);

  const loadLog = useCallback(async () => {
    try { setLog((await api('/api/admin/log?limit=100')).entries); } catch { setLog([]); }
  }, []);

  const refreshAll = useCallback(() => {
    loadStats();
    loadUsers();
    loadPosts();
    loadReports();
    if (tab === 'log') loadLog();
  }, [loadStats, loadUsers, loadPosts, loadReports, loadLog, tab]);

  useEffect(() => {
    api('/api/auth/session').then((data) => {
      if (!data.user?.is_admin) { setUnauthorized(true); return; }
      setUser(data.user);
      refreshAll();
    }).catch(() => setUnauthorized(true));
  }, [refreshAll]);

  useEffect(() => {
    if (tab === 'log') loadLog();
  }, [tab, loadLog]);

  async function adminAct(method, path, body) {
    try {
      const data = await api(path, { method, body: body ? JSON.stringify(body) : undefined });
      setStatusMsg(data.created !== undefined ? `Created ${data.created} users` : data.status || 'Done');
      refreshAll();
    } catch (err) {
      setStatusMsg(err.message);
    }
  }

  async function bulkAct(action) {
    const idsMap = { suspend_users: selectedUsers, unsuspend_users: selectedUsers, delete_users: selectedUsers, hide_posts: selectedPosts, unhide_posts: selectedPosts, delete_posts: selectedPosts };
    const ids = [...(idsMap[action] || [])];
    if (ids.length === 0) return setStatusMsg('Select items first');
    await adminAct('POST', '/api/admin/bulk', { action, ids });
    setSelectedUsers(new Set());
    setSelectedPosts(new Set());
  }

  function toggleSelect(set, setter, id) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (unauthorized) {
    return (
      <main className="shell">
        <p className="status" style={{ textAlign: 'center', marginTop: '4rem', fontSize: '1.2rem' }}>
          Admin access required. <a href="/">Back to home</a>
        </p>
      </main>
    );
  }

  if (!user || !stats) {
    return <main className="shell"><p className="status">Loading admin panel...</p></main>;
  }

  return (
    <main className="shell adminShell">
      <div className="adminHeader">
        <a className="backLink" href="/">← Back to home</a>
        <h1>Admin Dashboard</h1>
        <span className="status">{statusMsg}</span>
        <button onClick={refreshAll}>Refresh all</button>
      </div>

      <section className="statsGrid">
        <StatCard label="Users" value={stats.users} />
        <StatCard label="Admins" value={stats.admins} />
        <StatCard label="Suspended" value={stats.suspended} />
        <StatCard label="Blocked" value={stats.blocked} />
        <StatCard label="Posts" value={stats.posts} />
        <StatCard label="Hidden" value={stats.hiddenPosts} />
        <StatCard label="Open" value={stats.reportsOpen} />
        <StatCard label="Resolved" value={stats.reportsResolved} />
        <StatCard label="Dismissed" value={stats.reportsDismissed} />
        <StatCard label="Comments" value={stats.commentsTotal} />
        <StatCard label="Messages" value={stats.messagesTotal} />
        <StatCard label="Follows" value={stats.followsTotal} />
        <StatCard label="Uploads" value={stats.uploadsTotal} />
        <StatCard label="Bookmarks" value={stats.bookmarksTotal} />
        <StatCard label="Audit" value={stats.auditLogTotal} />
      </section>

      <section className="card seedSection">
        <h2>Seed Users</h2>
        <p className="status">Password: <strong>Password123!</strong></p>
        <div className="inline seedButtons">
          {[1, 5, 10, 15, 20].map((n) => (
            <button key={n} onClick={() => adminAct('POST', '/api/admin/seed/users', { count: n })}>+{n}</button>
          ))}
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '.5rem 0' }} />
        <h2>Add User</h2>
        <form className="inline" onSubmit={(e) => { e.preventDefault(); const f = e.target; adminAct('POST', '/api/admin/users', { username: f.username.value, email: f.email.value, password: f.password.value }); f.reset(); }}>
          <input name="username" placeholder="Username" required minLength={3} />
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" placeholder="Password123!" />
          <button type="submit">Create</button>
        </form>
      </section>

      <AdminTabs
        tabs={[
          { key: 'users', label: `Users (${stats.users})` },
          { key: 'posts', label: `Posts (${stats.posts})` },
          { key: 'reports', label: `Reports (${stats.reportsOpen} open)` },
          { key: 'log', label: `Activity` }
        ]}
        active={tab}
        onChange={(t) => { setTab(t); setSelectedUsers(new Set()); setSelectedPosts(new Set()); }}
      />

      {tab === 'users' && (
        <section className="adminSection">
          <div className="inline" style={{ marginBottom: '.5rem' }}>
            <input placeholder="Search username or email..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
            <button className="secondaryButton" onClick={() => bulkAct('suspend_users')} disabled={selectedUsers.size === 0}>Suspend selected</button>
            <button className="secondaryButton" onClick={() => bulkAct('unsuspend_users')} disabled={selectedUsers.size === 0}>Unsuspend selected</button>
            <button className="danger" onClick={() => { if (confirm(`Delete ${selectedUsers.size} user(s)?`)) bulkAct('delete_users'); }} disabled={selectedUsers.size === 0}>Delete selected</button>
          </div>
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th><input type="checkbox" onChange={(e) => { const all = users.filter(u => !userSearch || u.username.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())); setSelectedUsers(new Set(e.target.checked ? all.map(u => u.id) : [])); }} /></th>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Posts</th>
                  <th>Followers</th>
                  <th>Blocks</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter((u) => !userSearch || u.username.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())).map((u) => (
                  <tr key={u.id}>
                    <td><input type="checkbox" checked={selectedUsers.has(u.id)} onChange={() => toggleSelect(selectedUsers, setSelectedUsers, u.id)} /></td>
                    <td>{u.id}</td>
                    <td>@{u.username}</td>
                    <td>{u.email}</td>
                    <td>{u.is_admin ? 'Admin' : 'User'}</td>
                    <td>{u.is_suspended ? 'Suspended' : 'Active'}</td>
                    <td>{u.post_count}</td>
                    <td>{u.follower_count}</td>
                    <td>{u.blocked_by_count}</td>
                    <td>{u.created_at?.slice(0, 10)}</td>
                    <td className="adminActions">
                      <button onClick={() => adminAct('PATCH', `/api/admin/users/${u.id}`, { is_admin: !u.is_admin })}>{u.is_admin ? 'Demote' : 'Promote'}</button>
                      <button onClick={() => adminAct('POST', `/api/admin/users/${u.id}/${u.is_suspended ? 'unsuspend' : 'suspend'}`)}>{u.is_suspended ? 'Unsuspend' : 'Suspend'}</button>
                      <button className="danger" onClick={() => { if (confirm(`Delete @${u.username}?`)) adminAct('DELETE', `/api/admin/users/${u.id}`); }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'posts' && (
        <section className="adminSection">
          <div className="inline" style={{ marginBottom: '.5rem' }}>
            <input placeholder="Search posts..." value={postSearch} onChange={(e) => setPostSearch(e.target.value)} />
            <select value={postFilter} onChange={(e) => setPostFilter(e.target.value)}>
              <option value="">All posts</option>
              <option value="0">Visible only</option>
              <option value="1">Hidden only</option>
            </select>
            <button className="secondaryButton" onClick={() => bulkAct('hide_posts')} disabled={selectedPosts.size === 0}>Hide selected</button>
            <button className="secondaryButton" onClick={() => bulkAct('unhide_posts')} disabled={selectedPosts.size === 0}>Unhide selected</button>
            <button className="danger" onClick={() => { if (confirm(`Delete ${selectedPosts.size} post(s)?`)) bulkAct('delete_posts'); }} disabled={selectedPosts.size === 0}>Delete selected</button>
          </div>
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th><input type="checkbox" onChange={(e) => setSelectedPosts(new Set(e.target.checked ? posts.map(p => p.id) : []))} /></th>
                  <th>ID</th>
                  <th>User</th>
                  <th>Body</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className={p.is_hidden ? 'rowHidden' : ''}>
                    <td><input type="checkbox" checked={selectedPosts.has(p.id)} onChange={() => toggleSelect(selectedPosts, setSelectedPosts, p.id)} /></td>
                    <td>{p.id}</td>
                    <td>@{p.username}</td>
                    <td className="postBodyCell">{p.body.slice(0, 80)}{p.body.length > 80 ? '…' : ''}</td>
                    <td>{p.like_count}</td>
                    <td>{p.comment_count}</td>
                    <td>{p.is_hidden ? 'Hidden' : 'Visible'}</td>
                    <td>{p.created_at?.slice(0, 10)}</td>
                    <td className="adminActions">
                      <button onClick={() => adminAct('DELETE', `/api/admin/posts/${p.id}`)} disabled={p.is_hidden}>Hide</button>
                      <button onClick={() => adminAct('POST', `/api/admin/posts/${p.id}/unhide`)} disabled={!p.is_hidden}>Unhide</button>
                    </td>
                  </tr>
                ))}
                {posts.length === 0 && <tr><td colSpan={9} className="status">No posts found</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'reports' && (
        <section className="adminSection">
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Reporter</th>
                  <th>Type</th>
                  <th>Target</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>@{r.reporter_username || 'deleted'}</td>
                    <td>{r.target_type}</td>
                    <td>{r.target_type === 'post' ? `#${r.target_id}` : r.target_username}</td>
                    <td className="postBodyCell">{r.reason}</td>
                    <td>{r.status}</td>
                    <td>{r.created_at?.slice(0, 10)}</td>
                    <td className="adminActions">
                      {r.status === 'open' ? (
                        <><button onClick={() => adminAct('POST', `/api/admin/reports/${r.id}/resolve`)}>Resolve</button><button onClick={() => adminAct('POST', `/api/admin/reports/${r.id}/dismiss`)}>Dismiss</button></>
                      ) : <span className="status">{r.status}</span>}
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && <tr><td colSpan={8} className="status">No reports</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'log' && (
        <section className="adminSection">
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {log.map((e) => (
                  <tr key={e.id}>
                    <td>{e.created_at?.slice(0, 19)}</td>
                    <td>@{e.admin_username || 'deleted'}</td>
                    <td>{e.action}</td>
                    <td>{e.target_type}#{e.target_id}</td>
                    <td className="postBodyCell">{e.details}</td>
                  </tr>
                ))}
                {log.length === 0 && <tr><td colSpan={5} className="status">No activity yet</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
