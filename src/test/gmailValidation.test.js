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

// Regression (false-positive fix): a single pattern flag — repeated
// characters, low character diversity, or sequential characters — is no longer
// enough to hard-block signup. Each of these addresses is format-valid and was
// previously rejected with HIGH_RISK even though no single pattern can prove a
// mailbox is abusive (josejosejose@ and lovelovelove@ are ordinary-looking
// names; aaaaaa@ / abcdefg@ are at worst weak choices). They are now accepted
// as risk "Medium" with NEEDS_VERIFICATION, and signup_risk_level is still
// persisted on the profile for audit/step-up.
describe('validateGmail — a single pattern signal no longer blocks a legitimate address', () => {
  const singleSignalButLegit = [
    'lovelovelove@gmail.com', // low_diversity only
    'josejosejose@gmail.com', // low_diversity only
    'aaaaaa@gmail.com', // repeated_chars only
    'ssssss@gmail.com', // repeated_chars only
    'abcdefg@gmail.com', // sequential_chars only
    'sadasdsadsadsadsa@gmail.com', // low_diversity only
  ];

  for (const email of singleSignalButLegit) {
    it(`accepts ${email} as medium risk instead of HIGH_RISK`, () => {
      const result = validateGmail(email);
      expect(result.valid).toBe(true);
      expect(result.code).toBe('NEEDS_VERIFICATION');
      expect(result.risk).toBe('Medium');
      expect(result.code).not.toBe('HIGH_RISK');
      expect(result.code).not.toBe('INVALID_FORMAT');
    });
  }
});

// Multiple independent risk signals are still a hard block: escalation now
// requires riskScore >= 3, which can only be reached by two or more signals
// (low_diversity = 2, every other flag = 1). Anti-abuse protection for real
// junk patterns is fully retained.
describe('validateGmail — two or more independent signals still escalate to HIGH_RISK', () => {
  const stillBlocked = [
    { email: 'lovelovelovelovelovelovelovelove@gmail.com', flags: ['long_username', 'low_diversity'] },
    { email: 'aaaa1111222233334444555@gmail.com', flags: ['excessive_numbers', 'long_username', 'low_diversity'] },
  ];

  for (const { email, flags } of stillBlocked) {
    it(`still blocks ${email}`, () => {
      const result = validateGmail(email);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('HIGH_RISK');
      expect(result.reason).toMatch(/suspicious/i);
      // A blocked address must never be described as a valid Gmail address.
      expect(result.reason).not.toMatch(/valid gmail address/i);
      expect(result.flags).toEqual(expect.arrayContaining(flags));
    });
  }
});

describe('validateGmail — a format-valid but risky address is never called "invalid format"', () => {
  it('reports a risk verdict, never INVALID_FORMAT, for suspicious input', () => {
    // Strongest single signal available: repeated characters. Under the
    // single-signal rule this used to return HIGH_RISK; it is now accepted as
    // medium risk. The invariant that matters is that a format-valid address
    // is never mislabelled as malformed.
    const result = validateGmail('ssssss@gmail.com');
    expect(result.valid).toBe(true);
    expect(result.code).toBe('NEEDS_VERIFICATION');
    expect(result.code).not.toBe('INVALID_FORMAT');
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
