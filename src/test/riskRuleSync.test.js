import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The Gmail risk verdict must be IDENTICAL in the browser and in the
// spam-prevention Edge Function, otherwise a user accepted client-side gets
// rejected by the server (or the reverse) for the same address. Both copies of
// the rule are read from disk and compared, so any drift fails the suite.
//
// The policy itself is also pinned here: risk scoring is LEVEL-ONLY (verified
// mailbox access comes from the Supabase confirmation link), so neither file
// may contain a risk-based hard block.

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const clientSrc = readFileSync(join(projectRoot, 'src', 'lib', 'sanitize.js'), 'utf8');
const serverSrc = readFileSync(
  join(projectRoot, 'supabase', 'functions', 'spam-prevention', 'index.ts'),
  'utf8'
);

function scoreWeights(src, variable) {
  const re = new RegExp(`${variable} \\+= (\\d+);`, 'g');
  return [...src.matchAll(re)].map((m) => Number(m[1]));
}

function flagOrder(src) {
  return [...src.matchAll(/flags\.push\("([a-z_]+)"\)/g)].map((m) => m[1]);
}

describe('risk rule sync — client and Edge Function agree', () => {
  it('flag weights are identical (low_diversity = 2, everything else = 1)', () => {
    expect(scoreWeights(clientSrc, 'riskScore')).toEqual(scoreWeights(serverSrc, 'score'));
    expect(scoreWeights(clientSrc, 'riskScore')).toEqual([1, 1, 1, 1, 2, 1]);
  });

  it('flag names are raised in the same order', () => {
    expect(flagOrder(clientSrc)).toEqual(flagOrder(serverSrc));
    expect(flagOrder(clientSrc)).toEqual([
      'excessive_numbers',
      'random_pattern',
      'long_username',
      'repeated_chars',
      'low_diversity',
      'sequential_chars',
    ]);
  });

  it('the medium-risk threshold (score >= 1) is identical in both files', () => {
    expect(clientSrc).toContain('riskScore >= 1');
    expect(serverSrc).toContain('riskScore >= 1');
  });

  it('neither file hard-blocks on risk score', () => {
    for (const src of [clientSrc, serverSrc]) {
      // No score threshold may reject an address...
      expect(src).not.toMatch(/riskScore\s*>=\s*[2-9]/);
      expect(src).not.toMatch(/score\s*>=\s*[2-9]/);
      // ...no legacy strong-risk escalation may linger...
      expect(src).not.toContain('strongRiskSignal');
      // ...and neither file may emit a HIGH_RISK verdict.
      expect(src).not.toMatch(/code:\s*["']HIGH_RISK["']/);
    }
  });
});
