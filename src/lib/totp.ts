import crypto from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    output += BASE32[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return output;
}

function decodeBase32(value) {
  const clean = String(value).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const character of clean) {
    const index = BASE32.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 secret');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export function createTotpSecret() {
  return encodeBase32(crypto.randomBytes(20));
}

export function totpCode(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 30_000);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret, code, timestamp = Date.now()) {
  const candidate = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(candidate)) return false;
  return [-1, 0, 1].some((window) => {
    const expected = totpCode(secret, timestamp + window * 30_000);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate));
  });
}

export function totpUri(secret, username) {
  const issuer = 'MySazz';
  const label = encodeURIComponent(`${issuer}:${username}`);
  return `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}
