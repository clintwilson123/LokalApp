import { describe, it, expect } from 'vitest';
import { computeSkillMatch, normalizeSkill } from '../lib/skillMatch';

// Every match score CJLink shows came from this file: gemini-match's response
// parse was broken (jsonMatch[1] on a pattern with no capture group), so
// aiSkillMatch's catch always returned whatever this produced. The tests are
// named for the wrong answers they used to give.

/**
 * Builds an alias index the way skillCatalog.js does: every skill's own name
 * maps to itself first, then each alias maps to its canonical name. Building
 * it from aliases alone would leave the canonical spelling unindexed, which
 * is not what production does.
 */
function aliasIndex(pairs) {
  const index = {};
  pairs.forEach(([alias, canonical]) => {
    index[normalizeSkill(canonical)] = canonical;
    index[normalizeSkill(alias)] = canonical;
  });
  return index;
}

describe('normalizeSkill', () => {
  it('lowercases and trims', () => {
    expect(normalizeSkill('  Microsoft Excel ')).toBe('microsoft excel');
  });

  it('turns punctuation and symbols into separators', () => {
    expect(normalizeSkill('Good communication!')).toBe('good communication');
    expect(normalizeSkill('HTML & CSS')).toBe('html css');
  });

  it('keeps the characters that carry meaning in a skill name', () => {
    expect(normalizeSkill('C++')).toBe('c++');
    expect(normalizeSkill('C#')).toBe('c#');
    expect(normalizeSkill('Node.js')).toBe('node.js');
  });

  it('tolerates a missing value', () => {
    expect(normalizeSkill(undefined)).toBe('');
    expect(normalizeSkill(null)).toBe('');
  });
});

describe('computeSkillMatch — empty input', () => {
  it('scores nothing when the job lists no requirements', () => {
    expect(computeSkillMatch('Excel, Word', [])).toEqual({
      matched: 0, total: 0, score: 0, matchedItems: [], missingItems: [],
    });
  });

  it('scores nothing when the applicant lists no skills', () => {
    const result = computeSkillMatch('', ['Excel']);
    expect(result).toMatchObject({ matched: 0, total: 1, score: 0 });
    expect(result.missingItems).toEqual(['Excel']);
  });
});

describe('computeSkillMatch — the false positives it used to give', () => {
  it('does NOT match "Java" against "JavaScript"', () => {
    // The old rule was skill.includes(req), so "java" sat inside
    // "javascript" and scored as a match.
    expect(computeSkillMatch('JavaScript', ['Java']).score).toBe(0);
  });

  it('does NOT match "JavaScript" against "Java" either', () => {
    expect(computeSkillMatch('Java', ['JavaScript']).score).toBe(0);
  });

  it('does NOT match "C" against "CSS"', () => {
    expect(computeSkillMatch('CSS', ['C']).score).toBe(0);
  });

  it('does NOT match "SQL" against "MySQL" as a substring', () => {
    // "sql" sits inside "mysql"; it is a different skill.
    expect(computeSkillMatch('MySQL', ['SQL']).score).toBe(0);
  });
});

describe('computeSkillMatch — the false negatives it used to give', () => {
  it('matches a shorter requirement inside a longer applicant skill', () => {
    const result = computeSkillMatch('Customer Service Rep', ['Customer Service']);
    expect(result).toMatchObject({ matched: 1, total: 1, score: 100 });
  });

  it('matches in the other direction too', () => {
    const result = computeSkillMatch('Customer Service', ['Customer Service Rep']);
    expect(result.score).toBe(100);
  });

  it('treats case and punctuation as irrelevant', () => {
    expect(computeSkillMatch('MICROSOFT EXCEL!', ['Microsoft Excel']).score).toBe(100);
  });

  it('counts each requirement separately', () => {
    const result = computeSkillMatch('Excel, Customer Service', ['Excel', 'Word', 'Customer Service']);
    expect(result).toMatchObject({ matched: 2, total: 3 });
    expect(result.score).toBe(67);
    expect(result.missingItems).toEqual(['Word']);
  });
});

describe('computeSkillMatch — aliases', () => {
  const index = aliasIndex([
    ['Good communication', 'Communication'],
    ['Communication Skills', 'Communication'],
    ['NodeJS', 'Node.js'],
    ['JS', 'JavaScript'],
  ]);

  it('matches two spellings of the same skill', () => {
    // Without the index these do not overlap at all: "good communication"
    // is not a substring of "communication" and vice versa.
    const result = computeSkillMatch('Communication', ['Good communication'], index);
    expect(result.score).toBe(100);
  });

  it('matches an alias to its canonical name', () => {
    expect(computeSkillMatch('Node.js', ['NodeJS'], index).score).toBe(100);
  });

  it('still works with no index supplied', () => {
    expect(computeSkillMatch('Communication', ['Good communication']).score).toBe(100);
  });

  it('does not let an alias bridge two genuinely different skills', () => {
    const result = computeSkillMatch('JavaScript', ['Java'], index);
    expect(result.score).toBe(0);
  });

  it('a longer applicant skill matches the shorter canonical name it resolves to', () => {
    const result = computeSkillMatch('Node.js developer', ['NodeJS'], index);
    expect(result.score).toBe(100);
  });
});

describe('computeSkillMatch — the contract callers rely on', () => {
  it('ignores blank requirement strings rather than scoring them as missing', () => {
    const result = computeSkillMatch('Excel', ['Excel', '', '   ']);
    expect(result).toMatchObject({ matched: 1, total: 1, score: 100 });
  });

  it('reports the requirement text back verbatim, not normalized', () => {
    const result = computeSkillMatch('Excel', ['Microsoft Excel']);
    expect(result.matchedItems).toEqual(['Microsoft Excel']);
  });

  it('always returns whole numbers', () => {
    expect(computeSkillMatch('A, B, C', ['A', 'B', 'C', 'D', 'E']).score).toBe(60);
  });
});
