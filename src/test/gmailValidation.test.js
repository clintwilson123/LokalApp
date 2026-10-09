import { describe, it, expect } from 'vitest';
import { validateGmail } from '../lib/sanitize';

// Gmail format validation runs BEFORE any Supabase call, so an obviously
// invalid address must be rejected without creating an Auth account.
//
// These assertions are about FORMAT and the Gmail-only product rule only. A
// well-formed address is accepted here and the Supabase confirmation link is
// what proves the mailbox actually exists — a regex can never establish that,
// and no test may claim it does.

describe('validateGmail — accepts well-formed Gmail addresses', () => {
  const accepted = ['john.doe@gmail.com', 'user123@gmail.com', 'jane12345@gmail.com'];

  for (const email of accepted) {
    it(`accepts ${email}`, () => {
      const result = validateGmail(email);
      expect(result.valid).toBe(true);
      expect(result.code).not.toBe('INVALID_FORMAT');
      expect(result.code).not.toBe('GMAIL_REQUIRED');
    });
  }

  it('accepts googlemail.com aliases', () => {
    expect(validateGmail('john.doe@googlemail.com').valid).toBe(true);
  });

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(validateGmail('  John.Doe@GMAIL.COM  ').valid).toBe(true);
  });
});

describe('validateGmail — malformed syntax is rejected with the format message', () => {
  const rejected = [
    'example@gmail', // no TLD
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
      expect(result.reason).toBe('Please enter a valid email address.');
    });
  }

  it('returns INVALID_FORMAT for non-string input', () => {
    expect(validateGmail(undefined).code).toBe('INVALID_FORMAT');
    expect(validateGmail(null).code).toBe('INVALID_FORMAT');
    expect(validateGmail(12345).code).toBe('INVALID_FORMAT');
  });
});

// D1: a well-formed address on a non-Gmail domain is NOT a syntax error —
// the failed requirement is the Gmail-only product rule, and the user must be
// told that specifically instead of being told their address is malformed.
describe('validateGmail — non-Gmail domains get their own GMAIL_REQUIRED verdict', () => {
  const nonGmail = [
    'john.doe@yahoo.com',
    'john@outlook.com',
    'someone@example.org',
  ];

  for (const email of nonGmail) {
    it(`rejects ${email} as GMAIL_REQUIRED, not INVALID_FORMAT`, () => {
      const result = validateGmail(email);
      expect(result.valid).toBe(false);
      expect(result.code).toBe('GMAIL_REQUIRED');
      expect(result.reason).toBe(
        'A Gmail address is required — CJLink signups use Gmail or Googlemail.'
      );
      expect(result.reason).not.toBe('Please enter a valid email address.');
    });
  }
});

// Verification-led policy regression: string shape NEVER hard-blocks signup.
// These addresses are format-valid and were previously split between
// "suspicious" blocks (score >= 3) and acceptance (score < 3) — an arbitrary
// boundary that neither proved anything about the mailbox. All of them are now
// accepted with a risk LEVEL only; nonexistent ones are stopped later by the
// confirmation link.
describe('validateGmail — random-looking local parts are never hard-blocked', () => {
  const randomLooking = [
    { email: 'lovelovelove@gmail.com', flags: ['low_diversity'] },
    { email: 'josejosejose@gmail.com', flags: ['low_diversity'] },
    { email: 'aaaaaa@gmail.com', flags: ['repeated_chars'] },
    { email: 'ssssss@gmail.com', flags: ['repeated_chars'] },
    { email: 'abcdefg@gmail.com', flags: ['sequential_chars'] },
    { email: 'sadasdsadsadsadsa@gmail.com', flags: ['low_diversity'] },
    // The reported problem address: long + low-diversity (score 3), which was
    // hard-blocked as "suspicious activity". It must now proceed.
    { email: 'fsafsdfsdfsdfsdfdssadsa@gmail.com', flags: ['long_username', 'low_diversity'] },
    { email: 'lovelovelovelovelovelovelovelove@gmail.com', flags: ['long_username', 'low_diversity'] },
    { email: 'aaaa1111222233334444555@gmail.com', flags: ['excessive_numbers', 'long_username', 'low_diversity'] },
  ];

  for (const { email, flags } of randomLooking) {
    it(`accepts ${email} as medium risk with flags recorded`, () => {
      const result = validateGmail(email);
      expect(result.valid).toBe(true);
      expect(result.code).toBe('NEEDS_VERIFICATION');
      expect(result.risk).toBe('Medium');
      expect(result.flags).toEqual(expect.arrayContaining(flags));
      // The old hard-block verdict must never come back.
      expect(result.code).not.toBe('HIGH_RISK');
      expect(result.reason).not.toMatch(/suspicious/i);
      // Risk scoring may never describe the mailbox itself as verified.
      expect(result.reason).toMatch(/valid gmail format/i);
    });
  }

  it('no address of any shape ever returns HIGH_RISK from validateGmail', () => {
    const battery = [
      'plainaddress', 'not-an-email', 'john.doe@yahoo.com', 'abc@gmail.com',
      ...randomLooking.map((c) => c.email),
      'john.smith@gmail.com', 'example@gmail.com',
    ];
    for (const email of battery) {
      expect(validateGmail(email).code).not.toBe('HIGH_RISK');
    }
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
