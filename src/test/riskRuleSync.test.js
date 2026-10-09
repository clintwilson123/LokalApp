import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The Gmail risk decision must be IDENTICAL in the browser and in the
// spam-prevention Edge Function, otherwise a user blocked client-side (or the
// reverse) sees an inconsistent verdict for the same address. Both copies of
// the rule are read from disk and compared, so any drift fails the suite.

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const clientSrc = readFileSync(join(projectRoot, 'src', 'lib', 'sanitize.js'), 'utf8');
const serverSrc = readFileSync(
  join(projectRoot, 'supabase', 'functions', 'spam-prevention', 'index.ts'),
  'utf8'
);

function strongRiskExpression(src) {
  const match = src.match(/const strongRiskSignal = ([^;]+);/);
  return match ? match[1].replace(/\s+/g, ' ').trim() : null;
}

function scoreWeights(src, variable) {
  const re = new RegExp(`${variable} \\+= (\\d+);`, 'g');
  return [...src.matchAll(re)].map((m) => Number(m[1]));
}

function flagOrder(src) {
  return [...src.matchAll(/flags\.push\("([a-z_]+)"\)/g)].map((m) => m[1]);
}

describe('risk rule sync — client and Edge Function agree', () => {
  it('both files define strongRiskSignal', () => {
    expect(strongRiskExpression(clientSrc)).not.toBeNull();
    expect(strongRiskExpression(serverSrc)).not.toBeNull();
  });

  it('strongRiskSignal is byte-identical in both files', () => {
    expect(strongRiskExpression(clientSrc)).toBe(strongRiskExpression(serverSrc));
  });

  it('escalates only on two or more independent signals (riskScore >= 3)', () => {
    const expr = strongRiskExpression(clientSrc);
    expect(expr).toBe('riskScore >= 3');
    // A single pattern flag must never hard-block on its own again.
    expect(expr).not.toMatch(/flags\.includes/);
  });

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
});
