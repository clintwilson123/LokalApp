import { describe, it, expect } from 'vitest';
import { AUTH_MSG, messageForCode } from '../lib/authErrors';

// Regression tests for the false "invalid Gmail address" signup bug.
// Error classification must be driven by explicit error codes only — never by
// matching words such as "gmail", "deliver" or "receive emails" in a message.

describe('messageForCode', () => {
  it('maps EMAIL_PROVIDER_ERROR to the neutral provider message', () => {
    expect(messageForCode('EMAIL_PROVIDER_ERROR', 'anything')).toBe(AUTH_MSG.emailProvider);
    expect(messageForCode('EMAIL_PROVIDER_ERROR', '')).toBe(AUTH_MSG.emailProvider);
  });

  it('maps legacy DELIVERY_FAILED to the neutral provider message', () => {
    expect(messageForCode('DELIVERY_FAILED', AUTH_MSG.emailProvider)).toBe(AUTH_MSG.emailProvider);
    expect(
      messageForCode(
        'DELIVERY_FAILED',
        'This Gmail address appears to be invalid or cannot receive emails. Please use a valid Gmail account.'
      )
    ).toBe(AUTH_MSG.emailProvider);
  });

  it('maps legacy UNDELIVERABLE to the neutral provider message', () => {
    expect(
      messageForCode(
        'UNDELIVERABLE',
        'This Gmail address appears to be invalid or cannot receive emails. Please use a valid Gmail account.'
      )
    ).toBe(AUTH_MSG.emailProvider);
  });

  it('never maps a recognised code to the old "cannot receive emails" text', () => {
    const legacyText =
      'This Gmail address appears to be invalid or cannot receive emails. Please use a valid Gmail account.';
    const recognisedCodes = [
      'EMAIL_PROVIDER_ERROR',
      'DELIVERY_FAILED',
      'UNDELIVERABLE',
      'HIGH_RISK',
      'SUSPICIOUS',
      'INVALID_FORMAT',
      'GMAIL_REQUIRED',
      'NETWORK',
      'SERVER_ERROR',
      'RATE_LIMITED',
      'CAPTCHA_FAILED',
      'ALREADY_REGISTERED',
    ];
    for (const code of recognisedCodes) {
      expect(messageForCode(code, legacyText)).not.toMatch(/cannot receive emails/i);
    }
  });

  it('handles ALREADY_REGISTERED by code, even when the message mentions Gmail', () => {
    const message = messageForCode(
      'ALREADY_REGISTERED',
      'An account with this Gmail address already exists (Gmail dots are ignored).'
    );
    expect(message).toBe(AUTH_MSG.alreadyRegistered);
  });

  it('maps HIGH_RISK to the suspicious-activity message, not the invalid-Gmail message', () => {
    expect(messageForCode('HIGH_RISK', 'any')).toBe(AUTH_MSG.suspicious);
    expect(messageForCode('SUSPICIOUS', 'any')).toBe(AUTH_MSG.suspicious);
    expect(AUTH_MSG.suspicious).toMatch(/suspicious/i);
  });

  it('maps INVALID_FORMAT to the malformed-address message', () => {
    expect(messageForCode('INVALID_FORMAT', 'any')).toBe(AUTH_MSG.invalidFormat);
    expect(AUTH_MSG.invalidFormat).toBe('Please enter a valid email address.');
  });

  it('maps GMAIL_REQUIRED to its own message, distinct from a malformed address', () => {
    expect(messageForCode('GMAIL_REQUIRED', 'any')).toBe(AUTH_MSG.gmailRequired);
    expect(AUTH_MSG.gmailRequired).toMatch(/gmail address is required/i);
    // The user must be able to tell WHICH requirement failed.
    expect(AUTH_MSG.gmailRequired).not.toBe(AUTH_MSG.invalidFormat);
    expect(AUTH_MSG.gmailRequired).not.toMatch(/valid email address/i);
  });


  it('maps NETWORK to the network message', () => {
    expect(messageForCode('NETWORK', 'any')).toBe(AUTH_MSG.network);
  });

  it('maps RATE_LIMITED, CAPTCHA_FAILED and SERVER_ERROR to their messages', () => {
    expect(messageForCode('RATE_LIMITED', 'any')).toBe(AUTH_MSG.rateLimited);
    expect(messageForCode('CAPTCHA_FAILED', 'any')).toBe(AUTH_MSG.captchaFailed);
    expect(messageForCode('SERVER_ERROR', 'any')).toBe(AUTH_MSG.serverError);

    // A rate-limit failure must stay distinguishable from a CAPTCHA failure:
    // the user is told to wait, never that the security check failed (and
    // vice versa), including GoTrue's own lowercase captcha_failed code.
    expect(AUTH_MSG.rateLimited).not.toBe(AUTH_MSG.captchaFailed);
    expect(messageForCode('RATE_LIMITED', 'any')).not.toBe(AUTH_MSG.captchaFailed);
    expect(messageForCode('captcha_failed', 'any')).toBe(AUTH_MSG.captchaFailed);
    expect(messageForCode('captcha_failed', 'any')).not.toBe(AUTH_MSG.rateLimited);
    expect(messageForCode('over_email_send_rate_limit', 'any')).not.toBe(AUTH_MSG.captchaFailed);
  });


  it('does not classify an unknown code whose message mentions gmail or deliver', () => {
    const gmailMsg = 'Could not look up that gmail account right now';
    expect(messageForCode('SOME_UNKNOWN_CODE', gmailMsg)).toBe(gmailMsg);

    const deliverMsg = 'Failed to deliver the payload';
    expect(messageForCode('EDGE_ERROR', deliverMsg)).toBe(deliverMsg);

    const invalidMsg = 'The request body was invalid JSON';
    expect(messageForCode('', invalidMsg)).toBe(invalidMsg);
  });

  it('falls back to the already-registered message only when no code is supplied', () => {
    expect(messageForCode('', 'User already registered')).toBe(AUTH_MSG.alreadyRegistered);
    expect(messageForCode('', 'duplicate key value violates unique constraint')).toBe(
      AUTH_MSG.alreadyRegistered
    );
  });

  it('falls back to the generic message when there is neither a code nor a message', () => {
    expect(messageForCode('', '')).toBe(AUTH_MSG.generic);
    expect(messageForCode('', '   ')).toBe(AUTH_MSG.generic);
    expect(messageForCode(undefined, undefined)).toBe(AUTH_MSG.generic);
  });
});

// ACCOUNT_CREATION_FAILED and ACCOUNT_CREATED_VERIFICATION_PENDING are distinct
// states and must never share a message.
describe('account state separation', () => {
  const deliveryCodes = ['EMAIL_PROVIDER_ERROR', 'DELIVERY_FAILED', 'UNDELIVERABLE'];

  it('Test 2 — a delivery failure AFTER the account exists uses the contextual message', () => {
    for (const code of deliveryCodes) {
      expect(messageForCode(code, 'anything', { accountCreated: true })).toBe(
        AUTH_MSG.emailProviderAfterCreate
      );
    }
    expect(AUTH_MSG.emailProviderAfterCreate).toMatch(/account was created successfully/i);
    expect(AUTH_MSG.emailProviderAfterCreate).toMatch(/couldn't send the verification email/i);
  });

  it('the contextual message is never used before the account exists', () => {
    for (const code of deliveryCodes) {
      expect(messageForCode(code, 'anything')).toBe(AUTH_MSG.emailProvider);
      expect(messageForCode(code, 'anything', { accountCreated: false })).toBe(
        AUTH_MSG.emailProvider
      );
    }
    expect(AUTH_MSG.emailProvider).not.toMatch(/account was created successfully/i);
  });

  it('a delivery failure is never reported as an invalid Gmail address', () => {
    for (const code of deliveryCodes) {
      const msg = messageForCode(code, 'anything', { accountCreated: true });
      expect(msg).not.toMatch(/valid gmail/i);
      expect(msg).not.toMatch(/cannot receive/i);
      expect(msg).not.toMatch(/invalid or cannot/i);
    }
  });

  it('account creation failure keeps its own message', () => {
    expect(messageForCode('INVALID_FORMAT', 'x')).toBe(AUTH_MSG.invalidFormat);
    expect(AUTH_MSG.invalidFormat).not.toMatch(/account was created successfully/i);
  });
});

describe('required user-facing messages', () => {
  it('Test 3 — invalid format', () => {
    expect(messageForCode('INVALID_FORMAT', 'x')).toBe('Please enter a valid email address.');
    // Format rejection must never claim anything about mailbox existence or
    // verification — only the confirmation link can prove access.
    expect(messageForCode('INVALID_FORMAT', 'x')).not.toMatch(/verified|exists|receive/i);
  });

  it('Test 3b — unsupported (non-Gmail) domain', () => {
    expect(messageForCode('GMAIL_REQUIRED', 'x')).toBe(
      'A Gmail address is required — CJLink signups use Gmail or Googlemail.'
    );
  });


  it('Test 4 — account already exists', () => {
    const msg = messageForCode('ALREADY_REGISTERED', 'x');
    expect(msg).toBe(
      'An account with this Gmail address already exists. Please log in or reset your password.'
    );
    // Must never be reclassified as an invalid address.
    expect(msg).not.toMatch(/valid gmail/i);
  });

  it('Test 4 — a raw Supabase duplicate message still resolves to the same text', () => {
    expect(messageForCode('', 'User already registered')).toBe(
      'An account with this Gmail address already exists. Please log in or reset your password.'
    );
  });

  it('Test 5 — wrong or expired OTP', () => {
    expect(messageForCode('INVALID_CODE', 'Invalid or expired verification code.')).toBe(
      'The verification code is incorrect or has expired. Please request a new code.'
    );
    expect(
      messageForCode('INVALID_CODE', 'Invalid or expired verification code.', {
        accountCreated: true,
      })
    ).toBe(AUTH_MSG.invalidOtp);
  });

  it('the generic "Unable to verify at this time" text is not used for OTP failures', () => {
    expect(messageForCode('INVALID_CODE', 'x')).not.toBe(AUTH_MSG.emailProvider);
    expect(messageForCode('INVALID_CODE', 'x')).not.toBe(AUTH_MSG.emailProviderAfterCreate);
  });
});

// Native Supabase Auth confirmation replaced the custom OTP functions, so the
// codes that reach messageForCode are now Supabase's own AuthApiError codes
// as well as ours.
describe('Supabase Auth API codes', () => {
  it('Test 4 � a duplicate reported by signUp() maps to the same message', () => {
    expect(messageForCode('user_already_exists', 'User already registered')).toBe(
      AUTH_MSG.alreadyRegistered
    );
    // ...and is never reported as an invalid address.
    expect(messageForCode('user_already_exists', 'User already registered')).not.toMatch(
      /valid gmail/i
    );
  });

  it('Test 9 � hitting the resend rate limit uses the rate-limit message', () => {
    expect(messageForCode('over_email_send_rate_limit', 'For security purposes')).toBe(
      AUTH_MSG.rateLimited
    );
    // Never an invalid-address or generic provider message.
    expect(messageForCode('over_email_send_rate_limit', 'x')).not.toBe(AUTH_MSG.invalidFormat);
    expect(messageForCode('over_email_send_rate_limit', 'x')).not.toBe(AUTH_MSG.emailProvider);
  });

  it('never reveals whether an address exists when a resend cannot find it', () => {
    expect(messageForCode('user_not_found', 'User not found')).toBe(AUTH_MSG.emailProvider);
    expect(messageForCode('user_not_found', 'User not found')).not.toMatch(/already registered/i);
  });

  it('maps GoTrue email_not_confirmed to the confirmation instruction, not to wrong-password/network', () => {
    expect(messageForCode('email_not_confirmed', 'Email not confirmed')).toBe(
      AUTH_MSG.emailNotConfirmed
    );
    expect(AUTH_MSG.emailNotConfirmed).toMatch(/confirm your email address/i);
    expect(AUTH_MSG.emailNotConfirmed).not.toBe('Wrong email or password.');
    expect(AUTH_MSG.emailNotConfirmed).not.toBe(AUTH_MSG.network);
    expect(AUTH_MSG.emailNotConfirmed).not.toBe(AUTH_MSG.captchaFailed);
  });


  it('maps an inexpressible address to the format message', () => {
    expect(messageForCode('email_address_invalid', 'x')).toBe(AUTH_MSG.invalidFormat);
  });

  it('maps a weak password without mentioning anything about the email', () => {
    expect(messageForCode('weak_password', 'x')).toBe(AUTH_MSG.weakPassword);
    expect(messageForCode('weak_password', 'x')).not.toMatch(/gmail|email/i);
  });

  it('an unrecognised Supabase code falls through to the server message', () => {
    expect(messageForCode('some_brand_new_code', 'Readable server message')).toBe(
      'Readable server message'
    );
    expect(messageForCode('some_brand_new_code', '')).toBe(AUTH_MSG.generic);
  });
});
