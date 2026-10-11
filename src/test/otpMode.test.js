import { describe, it, expect, vi, afterEach } from 'vitest';

// The OTP feature flag and the delivery-failure classifiers behind it.
// isOtpDeliveryEnabled() is the single switch between the 6-digit CODE panel
// and the safe confirmation-LINK panel. Email OTP is now PRIMARY: the panel
// is on unless the flag is explicitly "false" (the rollback).

import { isOtpDeliveryEnabled } from '../lib/otpMode';
import {
  AUTH_MSG,
  messageForResendError,
  isEmailDeliveryFailure,
} from '../lib/authErrors';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isOtpDeliveryEnabled', () => {
  it('is ON when the variable is missing — the OTP panel is the default', () => {
    vi.stubEnv('VITE_OTP_ENABLED', undefined);
    expect(isOtpDeliveryEnabled()).toBe(true);
  });

  it('is ON for any value other than an explicit "false"', () => {
    vi.stubEnv('VITE_OTP_ENABLED', 'true');
    expect(isOtpDeliveryEnabled()).toBe(true);
    vi.stubEnv('VITE_OTP_ENABLED', '1');
    expect(isOtpDeliveryEnabled()).toBe(true);
    vi.stubEnv('VITE_OTP_ENABLED', 'yes');
    expect(isOtpDeliveryEnabled()).toBe(true);
    vi.stubEnv('VITE_OTP_ENABLED', '');
    expect(isOtpDeliveryEnabled()).toBe(true);
  });

  it('is OFF only for an explicit "false", tolerating case and surrounding whitespace', () => {
    vi.stubEnv('VITE_OTP_ENABLED', 'false');
    expect(isOtpDeliveryEnabled()).toBe(false);
    vi.stubEnv('VITE_OTP_ENABLED', 'FALSE');
    expect(isOtpDeliveryEnabled()).toBe(false);
    vi.stubEnv('VITE_OTP_ENABLED', '  false  ');
    expect(isOtpDeliveryEnabled()).toBe(false);
  });
});

describe('messageForResendError — never echoes server text', () => {
  it('maps known codes exactly', () => {
    expect(
      messageForResendError({ code: 'captcha_failed', message: 'captcha protection' })
    ).toBe(AUTH_MSG.captchaFailed);
    expect(
      messageForResendError({
        code: 'over_email_send_rate_limit',
        message: 'For security purposes',
      })
    ).toBe(AUTH_MSG.rateLimited);
  });

  it('reports an account-aware delivery message for unknown codes — not the raw text', () => {
    const raw = 'hook returned 500: stack trace at send-auth-email/index.ts';
    const msg = messageForResendError({ code: '', message: raw }, { accountCreated: true });
    expect(msg).toBe(AUTH_MSG.emailProviderAfterCreate);
    expect(msg).not.toContain('stack trace');
    expect(msg).not.toContain('send-auth-email');
  });

  it('uses the pre-account wording when the account may not exist yet', () => {
    expect(messageForResendError({ code: '', message: 'boom' })).toBe(AUTH_MSG.emailProvider);
  });

  it('classifies connectivity failures as the network message', () => {
    expect(messageForResendError(new TypeError('Failed to fetch'))).toBe(AUTH_MSG.network);
    expect(
      messageForResendError({ code: '', message: 'NetworkError when attempting to fetch' })
    ).toBe(AUTH_MSG.network);
  });

  it('keeps the accountCreated override for the legacy delivery codes', () => {
    expect(
      messageForResendError({ code: 'EMAIL_PROVIDER_ERROR', message: 'x' }, { accountCreated: true })
    ).toBe(AUTH_MSG.emailProviderAfterCreate);
    expect(
      messageForResendError({ code: 'EMAIL_PROVIDER_ERROR', message: 'x' })
    ).toBe(AUTH_MSG.emailProvider);
  });
});

describe('isEmailDeliveryFailure — signUp() hook/mailer failures', () => {
  it('recognises the Send Email hook failure codes', () => {
    expect(isEmailDeliveryFailure({ code: 'unexpected_failure', message: 'x' })).toBe(true);
    expect(isEmailDeliveryFailure({ code: 'EMAIL_PROVIDER_ERROR', message: 'x' })).toBe(true);
    expect(isEmailDeliveryFailure({ code: 'DELIVERY_FAILED', message: 'x' })).toBe(true);
    expect(isEmailDeliveryFailure({ code: 'email_send_failed', message: 'x' })).toBe(true);
  });

  it('recognises a 5xx whose own message mentions the email path', () => {
    expect(
      isEmailDeliveryFailure({ code: '', status: 500, message: 'Error sending confirmation email' })
    ).toBe(true);
  });

  it('never treats a validation or CAPTCHA failure as a delivery problem', () => {
    expect(isEmailDeliveryFailure({ code: 'weak_password', message: 'Password is too short' })).toBe(
      false
    );
    expect(isEmailDeliveryFailure({ code: 'captcha_failed', message: 'disallowed' })).toBe(false);
    expect(isEmailDeliveryFailure({ code: 'user_already_exists', message: 'already registered' })).toBe(
      false
    );
    expect(
      isEmailDeliveryFailure({ code: '', status: 500, message: 'database unavailable' })
    ).toBe(false);
    expect(isEmailDeliveryFailure(undefined)).toBe(false);
    expect(isEmailDeliveryFailure(null)).toBe(false);
  });
});
