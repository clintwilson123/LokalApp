import { describe, it, expect, vi, afterEach } from 'vitest';
import { aiSkillMatch } from '../lib/aiSkillMatch';
import { callEdgeFunction } from '../lib/supabaseClient';

// gemini-match has spent most of its life unreachable — first a broken JSON
// parse, then a retired model, then a function that was never deployed — so
// every path through here has to degrade to the local matcher instead of
// throwing or hanging. The timeout is the one that mattered most: a stalled
// request used to pin the whole applicant scan open with no way out.

vi.mock('../lib/supabaseClient', () => ({
  callEdgeFunction: vi.fn(),
}));

vi.mock('../lib/skillCatalog', () => ({
  loadSkillCatalog: vi.fn(async () => ({ aliasIndex: {} })),
}));

/** Lets the awaited catalog lookup (and everything queued behind it) settle. */
const flushMicrotasks = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

afterEach(() => {
  vi.useRealTimers();
  callEdgeFunction.mockReset();
});

describe('aiSkillMatch', () => {
  it('uses the Gemini result when the edge call returns', async () => {
    callEdgeFunction.mockResolvedValue({
      matchedItems: ['Excel'],
      missingItems: ['Word'],
      explanation: 'Matches Excel only.',
    });

    const result = await aiSkillMatch('Excel', ['Excel', 'Word'], 'Admin');

    expect(callEdgeFunction).toHaveBeenCalledWith('gemini-match', {
      applicantSkills: 'Excel',
      jobRequirements: ['Excel', 'Word'],
      jobTitle: 'Admin',
    });
    expect(result.explanation).toBe('Matches Excel only.');
    // total comes from the local pass, so the score can never disagree with it.
    expect(result.score).toBe(50);
    expect(result.matchedItems).toEqual(['Excel']);
  });

  it('falls back to the local match when the edge call never returns', async () => {
    vi.useFakeTimers();
    // Hangs forever — exactly what a stalled request looked like before the
    // ceiling existed.
    callEdgeFunction.mockImplementation(() => new Promise(() => {}));

    const pending = aiSkillMatch('Excel', ['Excel', 'Word'], 'Admin');
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(12000);

    const result = await pending;

    expect(result.explanation).toContain('basic match');
    // 1 of 2 requirements met locally — the answer is degraded, not lost.
    expect(result.basicScore).toBe(50);
    expect(result.matchedItems).toEqual(['Excel']);
  });

  it('falls back to the local match when the edge function rejects', async () => {
    callEdgeFunction.mockRejectedValue(new Error('Admin access required'));

    const result = await aiSkillMatch('Excel, Word', ['Excel', 'Word'], 'Admin');

    expect(result.explanation).toContain('basic match');
    expect(result.basicScore).toBe(100);
  });

  it('returns an empty result when the job asks for nothing', async () => {
    const result = await aiSkillMatch('Excel', [], 'Admin');

    expect(result.score).toBe(0);
    expect(callEdgeFunction).not.toHaveBeenCalled();
  });
});
