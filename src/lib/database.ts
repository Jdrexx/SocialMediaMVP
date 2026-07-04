// @ts-nocheck
import Database from 'better-sqlite3';
import pg from 'pg';

/**
 * Abstract database wrapper supporting both SQLite (local/testing) and PostgreSQL (production).
 * Provides async-compatible get/all/run/transaction/exec methods.
 */
export function createDatabase(connectionString) {
  if (!connectionString || connectionString.startsWith('sqlite:')) {
    const path = connectionString ? connectionString.replace(/^sqlite:/, '') : ':memory:';
    return createSQLiteDatabase(path);
  }
  if (connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://')) {
    return createPostgresDatabase(connectionString);
  }
  return createSQLiteDatabase(':memory:');
}

// ── SQLite Implementation ──

function createSQLiteDatabase(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return {
    _type: 'sqlite',
    _db: db,

    get(sql, ...params) {
      return db.prepare(sql).get(...params) || null;
    },

    all(sql, ...params) {
      return db.prepare(sql).all(...params);
    },

    run(sql, ...params) {
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);
      return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) };
    },

    transaction(fn) {
      const tx = db.transaction(fn);
      return tx;
    },

    exec(sql) {
      return db.exec(sql);
    },

    hasColumn(table, column) {
      return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
    },

    addColumn(table, column, definition) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    },

    close() {
      db.close();
    }
  };
}

// ── PostgreSQL Implementation ──

function createPostgresDatabase(connectionString) {
  const pool = new pg.Pool({ connectionString });

  const impl = {
    _type: 'postgres',
    _pool: pool,
    _txClient: null,

    async get(sql, ...params) {
      const { text, values } = convertPlaceholders(sql, params);
      const client = impl._txClient || pool;
      const result = await client.query(text, values);
      return result.rows[0] || null;
    },

    async all(sql, ...params) {
      const { text, values } = convertPlaceholders(sql, params);
      const client = impl._txClient || pool;
      const result = await client.query(text, values);
      return result.rows;
    },

    async run(sql, ...params) {
      let queryText = sql;
      const isInsert = /^\s*INSERT/i.test(sql);
      if (isInsert && !/RETURNING/i.test(sql)) {
        queryText = sql.replace(/;\s*$/, '') + ' RETURNING id';
      }
      const { text, values } = convertPlaceholders(queryText, params);
      const client = impl._txClient || pool;
      const result = await client.query(text, values);
      return {
        changes: result.rowCount,
        lastInsertRowid: result.rows[0]?.id || null
      };
    },

    transaction(fn) {
      return async () => {
        const client = await pool.connect();
        impl._txClient = client;
        try {
          await client.query('BEGIN');
          const result = await fn();
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          impl._txClient = null;
          client.release();
        }
      };
    },

    async exec(sql) {
      await pool.query(sql);
    },

    async hasColumn(table, column) {
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [table, column]
      );
      return result.rows.length > 0;
    },

    async addColumn(table, column, definition) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
    },

    async close() {
      await pool.end();
    }
  };

  return impl;
}

// Helper: convert ? placeholders to $N for PostgreSQL
function convertPlaceholders(sql, params) {
  if (!params || params.length === 0) {
    return { text: sql, values: [] };
  }
  let index = 0;
  const text = sql.replace(/\?/g, () => `$${++index}`);
  return { text, values: params };
}
