import crypto from 'node:crypto';
import { sendJson } from './http';

const COOKIE_NAME = 'bb_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function parseCookies(req: any): Record<string, string> {
  const raw = String(req.headers.cookie || '');
  const out: Record<string, string> = {};

  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (!key) continue;
    out[key] = decodeURIComponent(rest.join('='));
  }

  return out;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function secureCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function makeToken(): string {
  const secret = getEnvOrThrow('AUTH_SECRET');
  const payloadObject = {
    exp: Date.now() + SESSION_TTL_MS,
    nonce: crypto.randomUUID()
  };
  const payload = Buffer.from(JSON.stringify(payloadObject)).toString('base64url');
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

function verifyToken(token: string): boolean {
  const secret = getEnvOrThrow('AUTH_SECRET');
  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = sign(payload, secret);
  if (!secureCompare(signature, expectedSignature)) {
    return false;
  }

  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
    if (!json.exp || Date.now() > json.exp) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function cookieOptions(maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'development' ? '' : '; Secure';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function loginIfPasscodeValid(req: any, res: any, passcode: string): boolean {
  const expectedPasscode = process.env.ADMIN_PASSCODE;
  if (!expectedPasscode) {
    sendJson(res, 500, { error: 'ADMIN_PASSCODE is not configured.' });
    return false;
  }

  if (!passcode || !secureCompare(passcode, expectedPasscode)) {
    sendJson(res, 401, { error: 'Invalid passcode.' });
    return false;
  }

  const token = makeToken();
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieOptions(Math.floor(SESSION_TTL_MS / 1000))}`);
  return true;
}

export function clearSessionCookie(res: any): void {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${cookieOptions(0)}`);
}

export function requireAdmin(req: any, res: any): boolean {
  try {
    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    if (!token || !verifyToken(token)) {
      sendJson(res, 401, { error: 'Admin authentication required.' });
      return false;
    }
    return true;
  } catch {
    sendJson(res, 500, { error: 'Auth validation failed.' });
    return false;
  }
}
