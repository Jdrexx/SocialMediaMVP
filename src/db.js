import Database from 'better-sqlite3';

export function createDatabase(filename = 'social.sqlite') {
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function hasColumn(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

function addColumnIfMissing(db, table, column, definition) {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      email_verified INTEGER NOT NULL DEFAULT 0,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_suspended INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      original_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, following_id),
      CHECK (follower_id != following_id)
    );

    CREATE TABLE IF NOT EXISTS likes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(sender_id, recipient_id, created_at ASC);
  `);

  addColumnIfMissing(db, 'users', 'email_verified', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'users', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'users', 'is_suspended', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'posts', 'media_id', 'INTEGER REFERENCES media(id) ON DELETE SET NULL');
  addColumnIfMissing(db, 'posts', 'is_hidden', 'INTEGER NOT NULL DEFAULT 0');
}
