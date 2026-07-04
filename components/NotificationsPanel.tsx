// @ts-nocheck
'use client';

import { api } from './api';

export default function NotificationsPanel({ notifications, onRefresh }) {
  async function markAllRead() {
    await api('/api/notifications/read-all', { method: 'POST' });
    onRefresh();
  }

  return (
    <section className="card notifications">
      <h2>Notifications</h2>
      <div className="inline">
        <button onClick={onRefresh}>Refresh</button>
        <button onClick={markAllRead} className="secondaryButton">Mark all read</button>
      </div>
      {notifications.map((n) => (
        <p key={n.id} className={!n.read_at ? 'unread' : ''}>
          {n.body}
        </p>
      ))}
    </section>
  );
}
