import 'express';
import 'socket.io';

// Augment Express Request with our custom user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email: string;
        bio: string;
        avatar_url: string;
        cover_url: string;
        email_verified: number;
        is_admin: number;
        is_suspended: number;
        password_hash: string;
        created_at: string;
      } | null;
    }
  }
}

// Augment Socket.IO Socket with our custom user property
declare module 'socket.io' {
  interface Socket {
    user?: {
      id: number;
      username: string;
      email: string;
      bio: string;
      avatar_url: string;
      cover_url: string;
      email_verified: number;
      is_admin: number;
      is_suspended: number;
      password_hash: string;
      created_at: string;
    } | null;
  }
}

// Supertest type augmentation for async response
declare module 'supertest' {
  interface Response {
    body: any;
    headers: Record<string, any>;
  }
}

// Better-sqlite3 statement type
declare module 'better-sqlite3' {
  interface Database {
    prepare(sql: string): Statement;
  }
  interface Statement {
    run(...params: any[]): { changes: number; lastInsertRowid: bigint };
    get(...params: any[]): any;
    all(...params: any[]): any[];
  }
}
