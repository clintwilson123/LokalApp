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

  it('maps INVALID_FORMAT to the invalid Gmail format message', () => {
    expect(messageForCode('INVALID_FORMAT', 'any')).toBe(AUTH_MSG.invalidFormat);
  });

  it('maps NETWORK to the network message', () => {
    expect(messageForCode('NETWORK', 'any')).toBe(AUTH_MSG.network);
  });

  it('maps RATE_LIMITED, CAPTCHA_FAILED and SERVER_ERROR to their messages', () => {
    expect(messageForCode('RATE_LIMITED', 'any')).toBe(AUTH_MSG.rateLimited);
    expect(messageForCode('CAPTCHA_FAILED', 'any')).toBe(AUTH_MSG.captchaFailed);
    expect(messageForCode('SERVER_ERROR', 'any')).toBe(AUTH_MSG.serverError);
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
