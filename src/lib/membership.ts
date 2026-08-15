import { ownUser, publicUser } from './auth';

export const TERMS_VERSION = '2026-08-14';
export const PRIVACY_VERSION = '2026-08-14';
export const COMMUNITY_RULES_VERSION = '2026-08-14';

export const REQUIRED_CONSENTS = [
  ['age_18_plus', 'self-attestation'],
  ['recovery_one_year', 'self-attestation'],
  ['member_confidentiality', COMMUNITY_RULES_VERSION],
  ['terms_of_service', TERMS_VERSION],
  ['privacy_policy', PRIVACY_VERSION],
  ['not_medical_care', TERMS_VERSION]
] as const;

export const CONNECTION_INTENTS = ['friendship', 'peer_support', 'chat', 'video_chat', 'romance', 'resource_sharing'] as const;
export const EXPERIENCE_TAGS = [
  'trauma',
  'substance_recovery',
  'mental_health_diversion',
  'loss_and_grief',
  'social_challenges',
  'rehab_experience',
  'court_navigation',
  'past_abuse',
  'parent_or_caregiver',
  'managed_mental_health'
] as const;
export const RELATIONSHIP_STATUSES = ['single', 'in_a_relationship', 'married', 'partnered', 'prefer_not_to_say'] as const;
export const PRESENCE_STATUSES = ['available', 'busy', 'offline'] as const;

export function parseStringArray(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string');
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export async function getMemberProfile(db, userId) {
  return await db.get('SELECT * FROM member_profiles WHERE user_id = ?', userId);
}

export function serializeMemberProfile(profile, own = false) {
  if (!profile) return null;
  const serialized: any = {
    relationship_status: profile.show_relationship_status || own ? profile.relationship_status : '',
    connection_intents: parseStringArray(profile.connection_intents),
    experience_tags: profile.show_experience_tags || own ? parseStringArray(profile.experience_tags) : [],
    city: profile.city,
    region: profile.region,
    presence_status: profile.presence_status,
    discoverable: Boolean(profile.discoverable),
    show_relationship_status: Boolean(profile.show_relationship_status),
    show_experience_tags: Boolean(profile.show_experience_tags),
    updated_at: profile.updated_at
  };
  if (own) {
    serialized.postal_code = profile.postal_code;
    serialized.search_radius_miles = profile.search_radius_miles;
  }
  return serialized;
}

export async function ownMember(db, user) {
  if (!user) return null;
  return {
    ...ownUser(user),
    onboarding_complete: Boolean(user.onboarding_complete),
    two_factor_enabled: Boolean(user.two_factor_enabled),
    member_profile: serializeMemberProfile(await getMemberProfile(db, user.id), true)
  };
}

export async function publicMember(db, user) {
  if (!user) return null;
  const profile = await getMemberProfile(db, user.id);
  if (!profile?.discoverable) return null;
  return {
    ...publicUser(user),
    member_profile: serializeMemberProfile(profile, false)
  };
}

export async function ensureMemberProfile(db, userId) {
  const existing = await getMemberProfile(db, userId);
  if (existing) return existing;
  await db.run('INSERT INTO member_profiles (user_id) VALUES (?)', userId);
  return await getMemberProfile(db, userId);
}

export async function isBlockedEitherWay(db, firstUserId, secondUserId) {
  return Boolean(await db.get(`
    SELECT 1 FROM blocks
    WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
  `, firstUserId, secondUserId, secondUserId, firstUserId));
}

export async function areConnected(db, firstUserId, secondUserId) {
  if (await isBlockedEitherWay(db, firstUserId, secondUserId)) return false;
  return Boolean(await db.get(`
    SELECT 1 FROM connections
    WHERE status = 'accepted'
      AND ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))
  `, firstUserId, secondUserId, secondUserId, firstUserId));
}

export async function connectionStatus(db, viewerId, otherUserId) {
  const connection = await db.get(`
    SELECT * FROM connections
    WHERE (requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?)
    ORDER BY id DESC LIMIT 1
  `, viewerId, otherUserId, otherUserId, viewerId);
  if (!connection) return 'none';
  if (connection.status === 'accepted') return 'connected';
  if (connection.status !== 'pending') return 'none';
  return connection.requester_id === viewerId ? 'outgoing_pending' : 'incoming_pending';
}

export async function recordRequiredConsents(db, userId) {
  for (const [consentType, documentVersion] of REQUIRED_CONSENTS) {
    const existing = await db.get(
      'SELECT id FROM user_consents WHERE user_id = ? AND consent_type = ? AND document_version = ? AND withdrawn_at IS NULL',
      userId, consentType, documentVersion
    );
    if (!existing) {
      await db.run(
        'INSERT INTO user_consents (user_id, consent_type, document_version) VALUES (?, ?, ?)',
        userId,
        consentType,
        documentVersion
      );
    }
  }
}
