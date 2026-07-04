// @ts-nocheck
/**
 * Schema initialization and migrations — supports both SQLite and PostgreSQL.
 */
export function createTables(db) {
  const isPG = db._type === 'postgres';

  db.exec(`
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

    CREATE TABLE IF NOT EXISTS activity_log (
      id ${isPG ? 'SERIAL' : 'INTEGER'} PRIMARY KEY,
      admin_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action ${isPG ? 'VARCHAR(100)' : 'TEXT'} NOT NULL,
      target_type ${isPG ? 'VARCHAR(50)' : 'TEXT'} NOT NULL,
      target_id ${isPG ? 'INTEGER' : 'INTEGER'} NOT NULL,
      details ${isPG ? 'TEXT' : 'TEXT'} NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

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
  ];
  for (const idx of indexes) {
    db.exec(idx);
  }

  // Column migrations (only for SQLite — PG has IF NOT EXISTS in ALTER TABLE)
  if (!isPG) {
    addColumnIfMissing(db, 'users', 'cover_url', 'TEXT NOT NULL DEFAULT \'\'');
    addColumnIfMissing(db, 'users', 'email_verified', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(db, 'users', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(db, 'users', 'is_suspended', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(db, 'posts', 'media_id', 'INTEGER REFERENCES media(id) ON DELETE SET NULL');
    addColumnIfMissing(db, 'posts', 'is_hidden', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(db, 'posts', 'edited', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(db, 'posts', 'updated_at', 'TEXT');
  }
}

function addColumnIfMissing(db, table, column, definition) {
  if (!db.hasColumn(table, column)) {
    db.addColumn(table, column, definition);
  }
}
