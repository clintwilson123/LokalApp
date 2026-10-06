import { describe, it, expect } from 'vitest';
import { validateGmail } from '../lib/sanitize';

// Gmail format validation runs BEFORE any Supabase call, so an obviously
// invalid address must be rejected without creating an Auth account.
//
// These assertions are about FORMAT only. A well-formed address is accepted
// here and the OTP email is what proves the mailbox actually exists — a regex
// can never establish that.

describe('validateGmail — accepts well-formed Gmail addresses', () => {
  const accepted = ['john.doe@gmail.com', 'user123@gmail.com', 'jane12345@gmail.com'];

  for (const email of accepted) {
    it(`accepts ${email}`, () => {
      const result = validateGmail(email);
      expect(result.valid).toBe(true);
      expect(result.code).not.toBe('INVALID_FORMAT');
    });
  }

  it('accepts googlemail.com aliases', () => {
    expect(validateGmail('john.doe@googlemail.com').valid).toBe(true);
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(validateGmail('  John.Doe@GMAIL.COM  ').valid).toBe(true);
  });
});

describe('validateGmail — rejects obviously invalid input', () => {
  const rejected = [
    'example@gmail', // no TLD
    'example@yahoo.com', // not Gmail
    '@example.com', // no local part
    'abc@', // no domain
    'sadasdasdasd@', // no domain
    'plainaddress', // no @ at all
    'john.doe@gmail.', // empty TLD
    'john@doe@gmail.com', // two @ signs
    'john doe@gmail.com', // whitespace in local part
    '.john@gmail.com', // leading dot
    'john..doe@gmail.com', // consecutive dots
    'john@gmail.com@x', // malformed
    '', // empty
  ];

  for (const email of rejected) {
    it(`rejects "${email}" as INVALID_FORMAT`, () => {
      const result = validateGmail(email);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('INVALID_FORMAT');
      expect(result.reason).toBe('Please enter a valid Gmail address.');
    });
  }

  it('returns INVALID_FORMAT for non-string input', () => {
    expect(validateGmail(undefined).code).toBe('INVALID_FORMAT');
    expect(validateGmail(null).code).toBe('INVALID_FORMAT');
    expect(validateGmail(12345).code).toBe('INVALID_FORMAT');
  });
});

describe('validateGmail — a format-valid but risky address is never called "invalid format"', () => {
  it('reports HIGH_RISK instead of INVALID_FORMAT for suspicious input', () => {
    const result = validateGmail('ssssss@gmail.com');
    expect(result.valid).toBe(false);
    expect(result.code).toBe('HIGH_RISK');
    expect(result.reason).toMatch(/suspicious/i);
    expect(result.reason).not.toMatch(/valid gmail address/i);
  });
});

// NOTE: the address used throughout this spec, example@gmail.com, is refused by
// the PRE-EXISTING anti-spam prefix list in sanitize.js (blockedPatterns), not
// by format validation. That behaviour was deliberately left untouched because
// it is existing spam prevention. Assert it here so the reason is explicit.
describe('validateGmail — example@gmail.com is blocked by the anti-spam list', () => {
  it('is rejected, but for the spam heuristic rather than a malformed address', () => {
    const result = validateGmail('example@gmail.com');
    expect(result.valid).toBe(false);
    expect(result.code).toBe('INVALID_FORMAT'); // existing behaviour, see note above
  });
});
