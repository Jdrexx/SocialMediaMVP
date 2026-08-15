/**
 * Schema initialization and migrations — supports both SQLite and PostgreSQL.
 */
export function createTables(db) {
  const isPG = db._type === 'postgres';

  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id ${isPG ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      username ${isPG ? 'VARCHAR(255)' : 'TEXT'} NOT NULL UNIQUE${isPG ? '' : ' COLLATE NOCASE'},
      email ${isPG ? 'VARCHAR(255)' : 'TEXT'} NOT NULL UNIQUE${isPG ? '' : ' COLLATE NOCASE'},
      password_hash ${isPG ? 'VARCHAR(255)' : 'TEXT'} NOT NULL,
      bio ${isPG ? 'TEXT' : 'TEXT'} NOT NULL DEFAULT '',
      avatar_url ${isPG ? 'VARCHAR(500)' : 'TEXT'} NOT NULL DEFAULT '',
      cover_url ${isPG ? 'VARCHAR(500)' : 'TEXT'} NOT NULL DEFAULT '',
      email_verified ${isPG ? 'SMALLINT' : 'INTEGER'} NOT NULL DEFAULT 0,
      is_admin ${isPG ? 'SMALLINT' : 'INTEGER'} NOT NULL DEFAULT 0,
      is_suspended ${isPG ? 'SMALLINT' : 'INTEGER'} NOT NULL DEFAULT 0,
      onboarding_complete ${isPG ? 'SMALLINT' : 'INTEGER'} NOT NULL DEFAULT 0,
      two_factor_enabled ${isPG ? 'SMALLINT' : 'INTEGER'} NOT NULL DEFAULT 0,
      mfa_secret ${isPG ? 'TEXT' : 'TEXT'},
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS media (
      id ${isPG ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      user_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      original_name ${isPG ? 'VARCHAR(500)' : 'TEXT'} NOT NULL,
      file_name ${isPG ? 'VARCHAR(500)' : 'TEXT'} NOT NULL,
      mime_type ${isPG ? 'VARCHAR(100)' : 'TEXT'} NOT NULL,
      size ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL,
      url ${isPG ? 'VARCHAR(1000)' : 'TEXT'} NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id ${isPG ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      user_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body ${isPG ? 'TEXT' : 'TEXT'} NOT NULL,
      image_url ${isPG ? 'VARCHAR(500)' : 'TEXT'} NOT NULL DEFAULT '',
      media_id ${isPG ? 'INTEGER' : 'INTEGER'} REFERENCES media(id) ON DELETE SET NULL,
      edited ${isPG ? 'SMALLINT' : 'INTEGER'} NOT NULL DEFAULT 0,
      updated_at TIMESTAMP,
      is_hidden ${isPG ? 'SMALLINT' : 'INTEGER'} NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, following_id),
      CONSTRAINT follows_no_self CHECK (follower_id != following_id)
    );

    CREATE TABLE IF NOT EXISTS likes (
      user_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id ${isPG ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      user_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      body ${isPG ? 'TEXT' : 'TEXT'} NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id ${isPG ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      user_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id ${isPG ? 'INTEGER' : 'INTEGER'} REFERENCES users(id) ON DELETE SET NULL,
      type ${isPG ? 'VARCHAR(50)' : 'TEXT'} NOT NULL,
      entity_type ${isPG ? 'VARCHAR(50)' : 'TEXT'} NOT NULL,
      entity_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL,
      body ${isPG ? 'TEXT' : 'TEXT'} NOT NULL DEFAULT '',
      read_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      id ${isPG ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      user_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type ${isPG ? 'VARCHAR(50)' : 'TEXT'} NOT NULL,
      token ${isPG ? 'VARCHAR(255)' : 'TEXT'} NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id ${isPG ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      reporter_id ${isPG ? 'INTEGER' : 'INTEGER'} REFERENCES users(id) ON DELETE SET NULL,
      target_type ${isPG ? 'VARCHAR(50)' : 'TEXT'} NOT NULL,
      target_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL,
      reason ${isPG ? 'TEXT' : 'TEXT'} NOT NULL,
      status ${isPG ? 'VARCHAR(20)' : 'TEXT'} NOT NULL DEFAULT 'open',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id ${isPG ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      sender_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body ${isPG ? 'TEXT' : 'TEXT'} NOT NULL,
      read_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      user_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS blocks (
      blocker_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (blocker_id, blocked_id),
      CONSTRAINT blocks_no_self CHECK (blocker_id != blocked_id)
    );

    CREATE TABLE IF NOT EXISTS member_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      relationship_status ${isPG ? 'VARCHAR(40)' : 'TEXT'} NOT NULL DEFAULT 'prefer_not_to_say',
      connection_intents TEXT NOT NULL DEFAULT '[]',
      experience_tags TEXT NOT NULL DEFAULT '[]',
      city ${isPG ? 'VARCHAR(100)' : 'TEXT'} NOT NULL DEFAULT '',
      region ${isPG ? 'VARCHAR(100)' : 'TEXT'} NOT NULL DEFAULT '',
      postal_code ${isPG ? 'VARCHAR(16)' : 'TEXT'} NOT NULL DEFAULT '',
      search_radius_miles INTEGER NOT NULL DEFAULT 25,
      discoverable ${isPG ? 'SMALLINT' : 'INTEGER'} NOT NULL DEFAULT 1,
      show_relationship_status ${isPG ? 'SMALLINT' : 'INTEGER'} NOT NULL DEFAULT 0,
      show_experience_tags ${isPG ? 'SMALLINT' : 'INTEGER'} NOT NULL DEFAULT 0,
      presence_status ${isPG ? 'VARCHAR(20)' : 'TEXT'} NOT NULL DEFAULT 'offline',
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_consents (
      id ${isPG ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      consent_type ${isPG ? 'VARCHAR(80)' : 'TEXT'} NOT NULL,
      document_version ${isPG ? 'VARCHAR(40)' : 'TEXT'} NOT NULL,
      accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      withdrawn_at TIMESTAMP,
      UNIQUE (user_id, consent_type, document_version)
    );

    CREATE TABLE IF NOT EXISTS connections (
      id ${isPG ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status ${isPG ? 'VARCHAR(20)' : 'TEXT'} NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (requester_id, recipient_id),
      CONSTRAINT connections_no_self CHECK (requester_id != recipient_id)
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id ${isPG ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      admin_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action ${isPG ? 'VARCHAR(100)' : 'TEXT'} NOT NULL,
      target_type ${isPG ? 'VARCHAR(50)' : 'TEXT'} NOT NULL,
      target_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL,
      details ${isPG ? 'TEXT' : 'TEXT'} NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Indexes (shared syntax)
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at ASC)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token)',
    'CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(sender_id, recipient_id, created_at ASC)',
    'CREATE INDEX IF NOT EXISTS idx_activity_log_admin ON activity_log(admin_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_activity_log_target ON activity_log(target_type, target_id)',
    'CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id)',
    'CREATE INDEX IF NOT EXISTS idx_member_profiles_location ON member_profiles(region, city)',
    'CREATE INDEX IF NOT EXISTS idx_connections_requester ON connections(requester_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_connections_recipient ON connections(recipient_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_user_consents_user ON user_consents(user_id, consent_type)',
  ];

  if (isPG) {
    return (async () => {
      await db.exec(schemaSql);
      await db.exec(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete SMALLINT NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled SMALLINT NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
      `);
      for (const idx of indexes) await db.exec(idx);
      await db.exec(`
        INSERT INTO member_profiles (user_id)
        SELECT users.id FROM users
        WHERE NOT EXISTS (SELECT 1 FROM member_profiles WHERE member_profiles.user_id = users.id)
      `);
    })();
  }

  db.exec(schemaSql);
  for (const idx of indexes) {
    db.exec(idx);
  }

  // Column migrations (only for SQLite — PG has IF NOT EXISTS in ALTER TABLE)
  if (!isPG) {
    addColumnIfMissing(db, 'users', 'cover_url', 'TEXT NOT NULL DEFAULT \'\'');
    addColumnIfMissing(db, 'users', 'email_verified', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(db, 'users', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(db, 'users', 'is_suspended', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(db, 'users', 'onboarding_complete', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(db, 'users', 'two_factor_enabled', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(db, 'users', 'mfa_secret', 'TEXT');
    addColumnIfMissing(db, 'posts', 'media_id', 'INTEGER REFERENCES media(id) ON DELETE SET NULL');
    addColumnIfMissing(db, 'posts', 'is_hidden', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(db, 'posts', 'edited', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(db, 'posts', 'updated_at', 'TEXT');
    db.run(`
      INSERT INTO member_profiles (user_id)
      SELECT users.id FROM users
      WHERE NOT EXISTS (SELECT 1 FROM member_profiles WHERE member_profiles.user_id = users.id)
    `);
  }
}

function addColumnIfMissing(db, table, column, definition) {
  if (!db.hasColumn(table, column)) {
    db.addColumn(table, column, definition);
  }
}
