import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The Send Email Auth Hook replaces GoTrue's mailer for EVERY auth email,
// so its security properties are load-bearing: a missing signature check
// would let anyone forge an email; a leaked token or a retry hint would put
// codes in inboxes twice (or in logs). The component contract is pinned
// the same way: verification is decided by supabase.auth.verifyOtp() on the
// server, the session it creates is released, and nothing here ever
// generates, stores or trusts a code locally.
//
// Both files are read from disk so any drift fails the suite — the same
// approach as riskRuleSync.test.js for the client/server risk rule.

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const hookSrc = readFileSync(
  join(projectRoot, 'supabase', 'functions', 'send-auth-email', 'index.ts'),
  'utf8'
);
const verifySrc = readFileSync(join(projectRoot, 'src', 'pages', 'VerifyEmail.jsx'), 'utf8');
const loginSrc = readFileSync(join(projectRoot, 'src', 'pages', 'Login.jsx'), 'utf8');

describe('send-auth-email — webhook security contract', () => {
  it('verifies the standardWebhooks signature before the payload is parsed', () => {
    expect(hookSrc).toContain('env("SEND_EMAIL_HOOK_SECRET")');
    expect(hookSrc).toMatch(/new Webhook\(secret\)\.verify\(payload, headers\)/);
    expect(hookSrc).toContain('new Response("Invalid signature", { status: 401 })');
    // Payload parsing happens strictly after verification.
    const verifyAt = hookSrc.indexOf('.verify(payload, headers)');
    const parseAt = hookSrc.indexOf('JSON.parse(payload)');
    expect(verifyAt).toBeGreaterThan(-1);
    expect(parseAt).toBeGreaterThan(verifyAt);
    expect(hookSrc).toContain('req.method !== "POST"');
  });

  it('exposes no CORS surface — Supabase Auth is the only caller', () => {
    expect(hookSrc).not.toMatch(/Access-Control-Allow-Origin/);
    expect(hookSrc).not.toMatch(/Access-Control-Allow-Methods/);
  });

  it('keeps every credential in the environment — nothing baked into the source', () => {
    const envNames = [
      'SEND_EMAIL_HOOK_SECRET',
      'EMAILJS_SERVICE_ID',
      'EMAILJS_TEMPLATE_ID',
      'EMAILJS_TEMPLATE_ACCOUNT_ID',
      'EMAILJS_PUBLIC_KEY',
      'APP_SITE_URL',
    ];
    for (const name of envNames) {
      expect(hookSrc).toContain(`env("${name}")`);
    }
    expect(hookSrc).not.toMatch(/whsec_/);
    expect(hookSrc).not.toMatch(/service_id:\s*["'][^"']+["']/);
    expect(hookSrc).not.toMatch(/template_id:\s*["'][^"']+["']/);
  });

  it('never logs the payload, a code or a token — errors carry action and status only', () => {
    expect(hookSrc).not.toMatch(/console\.(log|info)\(/);
    expect(hookSrc).toContain(
      'console.error("send-auth-email: EmailJS rejected the send", { action, status: emailRes.status })'
    );
    // No console call may ever receive a payload field or a resolved value.
    expect(hookSrc).not.toMatch(/console\.\w+\([^)]*emailData\./);
    expect(hookSrc).not.toMatch(/console\.\w+\([^)]*\b(tokenHash|spec\.params)\b/);
  });

  it('suppresses unknown actions with 200 and never double-sends on failure', () => {
    expect(hookSrc).toContain('return new Response(null, { status: 200 });');
    expect(hookSrc).toMatch(/suppressed unknown email action/);
    // EmailJS failure -> plain 500. GoTrue only retries rate-limit and
    // unavailable responses, so no retry hint may ever appear: a retry
    // would deliver the user a duplicate email.
    expect(hookSrc).toContain('return json({ error: "Failed to send email" }, 500);');
    expect(hookSrc).not.toMatch(/\b429\b|\b503\b/);
    expect(hookSrc).not.toMatch(/Retry-After/i);
  });

  it('restricts every verify-link redirect to APP_SITE_URL', () => {
    expect(hookSrc).toContain('function trustedRedirect(');
    expect(hookSrc).toContain('target.origin !== base.origin');
    expect(hookSrc).toMatch(/trustedRedirect\(emailData\.redirect_to, appSiteUrl\)/);
  });

  it('routes codes and links down separate, explicit action sets', () => {
    expect(hookSrc).toContain('const CODE_ACTIONS = new Set(["signup", "reauthentication"]);');
    expect(hookSrc).toContain(
      'const LINK_ACTIONS = new Set(["recovery", "magiclink", "invite"]);'
    );
    expect(hookSrc).toMatch(/CODE_ACTIONS\.has\(action\)/);
    expect(hookSrc).toMatch(/LINK_ACTIONS\.has\(action\)/);
    // Verify links are built from the hash GoTrue can validate server-side,
    // never from the short-lived code itself.
    expect(hookSrc).toContain('url.searchParams.set("token_hash", tokenHash)');
    expect(hookSrc).not.toContain('searchParams.set("token", ');
  });
});

describe('VerifyEmail — server-verified OTP contract', () => {
  it('asks Supabase Auth to validate the code (type signup) — never a local check', () => {
    expect(verifySrc).toContain('supabase.auth.verifyOtp');
    expect(verifySrc).toContain('type: "signup"');
    expect(verifySrc).not.toMatch(/Math\.random/);
    expect(verifySrc).not.toMatch(/verification_codes/);
  });

  it('releases the session verification creates — verification never logs in', () => {
    expect(verifySrc).toContain('signOut({ scope: "local" })');
    expect(verifySrc).toContain('AUTH_MSG.verifiedSuccess');
    expect(verifySrc).toContain('writeLoginFlash(sessionEmail)');
  });

  it('the old self-claim path is gone — only the server can confirm', () => {
    expect(verifySrc).not.toContain('handleConfirmed');
    expect(verifySrc).not.toContain('showSignIn');
    expect(verifySrc).not.toMatch(/I'?ve confirmed my email/);
  });

  it('/login accepts the hand-off via navigation state or the one-shot flash', () => {
    expect(loginSrc).toContain('readLoginFlash');
    expect(loginSrc).toContain('clearLoginFlash');
    // The flash is consumed once, right after mount — not on every render.
    expect(loginSrc).toMatch(/useEffect\(\(\) => \{\s*clearLoginFlash\(\);/);
  });
});
