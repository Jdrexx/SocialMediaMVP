// @ts-nocheck
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { memberRequired } from '../../lib/http';

export function createUploadsRouter({ db, config }) {
  const router = express.Router();
  const uploadDir = path.resolve(config.uploadDir);
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
      // Block SVG uploads — SVG can carry XSS due to inline script execution.
      if (file.mimetype === 'image/svg+xml') return cb(new Error('SVG uploads are not allowed'));
      if (file.mimetype === 'image/xml' || file.mimetype === 'image/svg') return cb(new Error('This image format is not allowed'));
      cb(null, true);
    }
  });

  router.post('/uploads', memberRequired, upload.single('media'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Upload a file in the media field' });
    const url = `/uploads/${req.file.filename}`;
    const result = await db.run(
      'INSERT INTO media (user_id, original_name, file_name, mime_type, size, url) VALUES (?, ?, ?, ?, ?, ?)',
      req.user.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, url
    );
    const media = await db.get('SELECT * FROM media WHERE id = ?', result.lastInsertRowid);
    res.status(201).json({ media });
  });

  return router;
}
