import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { authRequired } from '../../lib/http.js';

const uploadDir = path.resolve('public', 'uploads');
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.bin';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) return cb(new Error('Only image/video uploads are allowed'));
    cb(null, true);
  }
});

export function createUploadsRouter({ db }) {
  const router = express.Router();

  router.post('/uploads', authRequired, upload.single('media'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Upload a file in the media field' });
    const url = `/uploads/${req.file.filename}`;
    const result = db.prepare(`
      INSERT INTO media (user_id, original_name, file_name, mime_type, size, url)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, url);
    const media = db.prepare('SELECT * FROM media WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ media });
  });

  return router;
}
