import { clearSessionCookie, loginIfPasscodeValid } from './_lib/auth';
import { methodNotAllowed, sendJson } from './_lib/http';
import { readJsonBody } from './_lib/json-body';

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  const action = String(req.query?.action || '').toLowerCase();

  if (action === 'logout') {
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (action !== 'login') {
    sendJson(res, 400, { error: 'Invalid auth action.' });
    return;
  }

  try {
    const body = await readJsonBody<{ passcode?: string }>(req);
    const passcode = String(body.passcode || '');
    const ok = loginIfPasscodeValid(req, res, passcode);
    if (!ok) {
      return;
    }

    sendJson(res, 200, { ok: true });
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body.' });
  }
}
