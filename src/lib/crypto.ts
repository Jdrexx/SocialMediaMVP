import crypto from 'node:crypto';

function keyBuffer(key) {
  if (/^[a-f0-9]{64}$/i.test(key || '')) return Buffer.from(key, 'hex');
  const decoded = Buffer.from(key || '', 'base64');
  if (decoded.length === 32) return decoded;
  throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters or base64');
}

export function encryptSensitive(value, key) {
  if (!value) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer(key), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSensitive(value, key) {
  if (!value || !String(value).startsWith('enc:v1:')) return value;
  try {
    const [, , ivValue, tagValue, encryptedValue] = String(value).split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer(key), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  } catch {
    return '[Unable to decrypt message]';
  }
}
