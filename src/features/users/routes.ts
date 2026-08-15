// @ts-nocheck
import express from 'express';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { authRequired, memberRequired } from '../../lib/http';
import { createNotification } from '../../lib/notifications';
import { getPosts } from '../../lib/posts';
import { ensureMemberProfile, isBlockedEitherWay, ownMember, parseStringArray, publicMember, recordRequiredConsents } from '../../lib/membership';
import { decryptSensitive } from '../../lib/crypto';
import { deleteAccountSchema, onboardingSchema, profileSchema } from '../../lib/schemas';

export function createUsersRouter({ db, config }) {
  const router = express.Router();

  router.get('/me', authRequired, async (req, res) => res.json({ user: await ownMember(db, req.user) }));

  router.post('/me/onboarding', authRequired, async (req, res) => {
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    await ensureMemberProfile(db, req.user.id);
    await db.run(`
      UPDATE member_profiles SET
        relationship_status = ?, connection_intents = ?, experience_tags = ?, city = ?, region = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `,
    parsed.data.relationship_status,
    JSON.stringify(parsed.data.connection_intents),
    JSON.stringify(parsed.data.experience_tags),
    parsed.data.city,
    parsed.data.region,
    req.user.id);
    await recordRequiredConsents(db, req.user.id);
    await db.run('UPDATE users SET onboarding_complete = 1 WHERE id = ?', req.user.id);
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    res.json({ user: await ownMember(db, user) });
  });

  router.patch('/me', memberRequired, async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

    const bio = parsed.data.bio ?? req.user.bio;
    const avatarUrl = parsed.data.avatar_url ?? req.user.avatar_url;
    const coverUrl = parsed.data.cover_url ?? req.user.cover_url;
    await db.run('UPDATE users SET bio = ?, avatar_url = ?, cover_url = ? WHERE id = ?', bio, avatarUrl, coverUrl, req.user.id);

    const current = await ensureMemberProfile(db, req.user.id);
    const field = (name, fallback = '') => parsed.data[name] === undefined ? current[name] ?? fallback : parsed.data[name];
    await db.run(`
      UPDATE member_profiles SET
        relationship_status = ?, connection_intents = ?, experience_tags = ?, city = ?, region = ?, postal_code = ?,
        search_radius_miles = ?, discoverable = ?, show_relationship_status = ?, show_experience_tags = ?,
        presence_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `,
    field('relationship_status', 'prefer_not_to_say'),
    JSON.stringify(parsed.data.connection_intents ?? parseStringArray(current.connection_intents)),
    JSON.stringify(parsed.data.experience_tags ?? parseStringArray(current.experience_tags)),
    field('city'), field('region'), field('postal_code'), field('search_radius_miles', 25),
    field('discoverable', true) ? 1 : 0,
    field('show_relationship_status', false) ? 1 : 0,
    field('show_experience_tags', false) ? 1 : 0,
    field('presence_status', 'offline'), req.user.id);

    const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    res.json({ user: await ownMember(db, user) });
  });

  router.post('/me/avatar', memberRequired, async (req, res) => {
    const mediaId = Number(req.body.media_id);
    const media = await db.get('SELECT * FROM media WHERE id = ? AND user_id = ? AND mime_type LIKE ?', mediaId, req.user.id, 'image/%');
    if (!media) return res.status(400).json({ error: 'Upload an image first and pass its media_id' });
    await db.run('UPDATE users SET avatar_url = ? WHERE id = ?', media.url, req.user.id);
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    res.json({ user: await ownMember(db, user) });
  });

  router.post('/me/cover', memberRequired, async (req, res) => {
    const mediaId = Number(req.body.media_id);
    const media = await db.get('SELECT * FROM media WHERE id = ? AND user_id = ? AND mime_type LIKE ?', mediaId, req.user.id, 'image/%');
    if (!media) return res.status(400).json({ error: 'Upload an image first and pass its media_id' });
    await db.run('UPDATE users SET cover_url = ? WHERE id = ?', media.url, req.user.id);
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    res.json({ user: await ownMember(db, user) });
  });

  router.get('/me/export', memberRequired, async (req, res) => {
    const [profile, consents, posts, comments, connections, rawMessages] = await Promise.all([
      db.get('SELECT * FROM member_profiles WHERE user_id = ?', req.user.id),
      db.all('SELECT consent_type, document_version, accepted_at, withdrawn_at FROM user_consents WHERE user_id = ? ORDER BY accepted_at', req.user.id),
      db.all('SELECT id, body, image_url, created_at, updated_at FROM posts WHERE user_id = ? ORDER BY created_at', req.user.id),
      db.all('SELECT id, post_id, body, created_at FROM comments WHERE user_id = ? ORDER BY created_at', req.user.id),
      db.all('SELECT id, requester_id, recipient_id, status, created_at, updated_at FROM connections WHERE requester_id = ? OR recipient_id = ? ORDER BY created_at', req.user.id, req.user.id),
      db.all('SELECT id, sender_id, recipient_id, body, read_at, created_at FROM messages WHERE sender_id = ? OR recipient_id = ? ORDER BY created_at', req.user.id, req.user.id)
    ]);
    const exported = {
      exported_at: new Date().toISOString(),
      account: { id: req.user.id, username: req.user.username, email: req.user.email, bio: req.user.bio, created_at: req.user.created_at },
      member_profile: profile,
      consents,
      posts,
      comments,
      connections,
      messages: rawMessages.map((message) => ({ ...message, body: decryptSensitive(message.body, config.dataEncryptionKey) }))
    };
    res.setHeader('Content-Disposition', 'attachment; filename="mysazz-data-export.json"');
    res.json(exported);
  });

  router.delete('/me', authRequired, async (req, res) => {
    const parsed = deleteAccountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!(await bcrypt.compare(parsed.data.password, user.password_hash))) return res.status(401).json({ error: 'Password is incorrect' });
    const media = await db.all('SELECT file_name FROM media WHERE user_id = ?', user.id);
    await db.run('DELETE FROM users WHERE id = ?', user.id);
    const uploadRoot = path.resolve(config.uploadDir);
    await Promise.all(media.map(async (item) => {
      const safeName = path.basename(item.file_name);
      if (safeName !== item.file_name) return;
      await unlink(path.join(uploadRoot, safeName)).catch(() => null);
    }));
    res.clearCookie('token');
    res.json({ ok: true });
  });

  router.get('/users/:username', memberRequired, async (req, res) => {
    const user = await db.get('SELECT * FROM users WHERE username = ?', req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.id !== req.user.id && await isBlockedEitherWay(db, req.user.id, user.id)) return res.status(404).json({ error: 'User not found' });

    const follower_count = Number((await db.get('SELECT COUNT(*) AS c FROM follows WHERE following_id = ?', user.id))?.c || 0);
    const following_count = Number((await db.get('SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?', user.id))?.c || 0);
    const following = req.user ? Boolean(await db.get('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?', req.user.id, user.id)) : false;

    const member = user.id === req.user.id ? await ownMember(db, user) : await publicMember(db, user);
    if (!member) return res.status(404).json({ error: 'User not found' });
    res.json({
      user: { ...member, follower_count, following_count, following },
      posts: await getPosts(db, req.user?.id, 'WHERE posts.user_id = ?', [user.id])
    });
  });

  router.post('/users/:username/follow', memberRequired, async (req, res) => {
    const target = await db.get('SELECT id FROM users WHERE username = ?', req.params.username);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot follow yourself' });
    if (await isBlockedEitherWay(db, req.user.id, target.id)) return res.status(404).json({ error: 'User not found' });

    const existing = await db.get('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?', req.user.id, target.id);
    if (existing) {
      await db.run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', req.user.id, target.id);
      return res.json({ following: false });
    }

    await db.run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', req.user.id, target.id);
    await createNotification(db, { userId: target.id, actorId: req.user.id, type: 'follow', entityType: 'user', entityId: req.user.id, body: `${req.user.username} followed you` });
    res.json({ following: true });
  });

  return router;
}
