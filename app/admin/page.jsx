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
  const [tab, setTab] = useState('stats');
  const [userSearch, setUserSearch] = useState('');
  const [postSearch, setPostSearch] = useState('');
  const [postFilter, setPostFilter] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);

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

  const refreshAll = useCallback(() => {
    loadStats();
    loadUsers();
    loadPosts();
    loadReports();
  }, [loadStats, loadUsers, loadPosts, loadReports]);

  // Verify session + admin on mount
  useEffect(() => {
    api('/api/auth/session').then((data) => {
      if (!data.user?.is_admin) { setUnauthorized(true); return; }
      setUser(data.user);
      refreshAll();
    }).catch(() => setUnauthorized(true));
  }, [refreshAll]);

  async function adminAct(method, path, body) {
    try {
      await api(path, { method, body: body ? JSON.stringify(body) : undefined });
      setStatusMsg('Done');
      refreshAll();
    } catch (err) {
      setStatusMsg(err.message);
    }
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

      {/* Stats cards */}
      <section className="statsGrid">
        <StatCard label="Users" value={stats.users} />
        <StatCard label="Admins" value={stats.admins} />
        <StatCard label="Suspended" value={stats.suspended} />
        <StatCard label="Posts" value={stats.posts} />
        <StatCard label="Hidden posts" value={stats.hiddenPosts} />
        <StatCard label="Open reports" value={stats.reportsOpen} />
        <StatCard label="Resolved reports" value={stats.reportsResolved} />
        <StatCard label="Dismissed reports" value={stats.reportsDismissed} />
        <StatCard label="Comments" value={stats.commentsTotal} />
        <StatCard label="Messages" value={stats.messagesTotal} />
        <StatCard label="Follows" value={stats.followsTotal} />
        <StatCard label="Uploads" value={stats.uploadsTotal} />
      </section>

      {/* Tabs */}
      <AdminTabs
        tabs={[
          { key: 'users', label: `Users (${stats.users})` },
          { key: 'posts', label: `Posts (${stats.posts})` },
          { key: 'reports', label: `Reports (${stats.reportsOpen} open)` }
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* Users tab */}
      {tab === 'users' && (
        <section className="adminSection">
          <div className="inline" style={{ marginBottom: '1rem' }}>
            <input placeholder="Search username or email..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
          </div>
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Posts</th>
                  <th>Followers</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users
                  .filter((u) => !userSearch || u.username.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
                  .map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>@{u.username}</td>
                      <td>{u.email}</td>
                      <td>{u.is_admin ? 'Admin' : 'User'}</td>
                      <td>{u.is_suspended ? 'Suspended' : 'Active'}</td>
                      <td>{u.post_count}</td>
                      <td>{u.follower_count}</td>
                      <td>{u.created_at?.slice(0, 10)}</td>
                      <td className="adminActions">
                        <button onClick={() => adminAct('PATCH', `/api/admin/users/${u.id}`, { is_admin: !u.is_admin })}>
                          {u.is_admin ? 'Demote' : 'Promote'}
                        </button>
                        <button onClick={() => adminAct('POST', `/api/admin/users/${u.id}/${u.is_suspended ? 'unsuspend' : 'suspend'}`)}>
                          {u.is_suspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Posts tab */}
      {tab === 'posts' && (
        <section className="adminSection">
          <div className="inline" style={{ marginBottom: '1rem' }}>
            <input placeholder="Search posts..." value={postSearch} onChange={(e) => setPostSearch(e.target.value)} />
            <select value={postFilter} onChange={(e) => setPostFilter(e.target.value)}>
              <option value="">All posts</option>
              <option value="0">Visible only</option>
              <option value="1">Hidden only</option>
            </select>
          </div>
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead>
                <tr>
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
                    <td>{p.id}</td>
                    <td>@{p.username}</td>
                    <td className="postBodyCell">{p.body.slice(0, 80)}{p.body.length > 80 ? '…' : ''}</td>
                    <td>{p.like_count}</td>
                    <td>{p.comment_count}</td>
                    <td>{p.is_hidden ? 'Hidden' : 'Visible'}</td>
                    <td>{p.created_at?.slice(0, 10)}</td>
                    <td className="adminActions">
                      <button onClick={() => adminAct('DELETE', `/api/admin/posts/${p.id}`)} disabled={p.is_hidden}>
                        Hide
                      </button>
                      <button onClick={() => adminAct('POST', `/api/admin/posts/${p.id}/unhide`)} disabled={!p.is_hidden}>
                        Unhide
                      </button>
                    </td>
                  </tr>
                ))}
                {posts.length === 0 && <tr><td colSpan={8} className="status">No posts found</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Reports tab */}
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
                      {r.status === 'open' && (
                        <>
                          <button onClick={() => adminAct('POST', `/api/admin/reports/${r.id}/resolve`)}>Resolve</button>
                          <button onClick={() => adminAct('POST', `/api/admin/reports/${r.id}/dismiss`)}>Dismiss</button>
                        </>
                      )}
                      {r.status !== 'open' && <span className="status">{r.status}</span>}
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && <tr><td colSpan={8} className="status">No reports</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
