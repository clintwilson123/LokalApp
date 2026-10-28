import { describe, it, expect, vi, afterEach } from 'vitest';
import { aiSkillMatch } from '../lib/aiSkillMatch';
import { callEdgeFunction } from '../lib/supabaseClient';

// gemini-match has spent most of its life unreachable — first a broken JSON
// parse, then a retired model, then a function that was never deployed — so
// every path through here has to degrade to the local matcher instead of
// throwing or hanging. The timeout is the one that mattered most: a stalled
// request used to pin the whole applicant scan open with no way out.
//
// On top of that, a scan makes one of these calls per applicant, so whether
// the local pass is allowed to end the question decides how long a scan takes
// at all. The AI is consulted only where the cheap matcher had nothing to say.

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
  it('uses the Gemini result for the requirements it was asked about', async () => {
    callEdgeFunction.mockResolvedValue({
      matchedItems: ['Word'],
      missingItems: [],
      explanation: 'Word is Office software.',
    });

    const result = await aiSkillMatch('Excel', ['Excel', 'Word'], 'Admin');

    // Only the requirement still in doubt is sent. Re-sending the exact local
    // match would have bought nothing, and a whole-roster scan makes this call
    // once per person.
    expect(callEdgeFunction).toHaveBeenCalledWith('gemini-match', {
      applicantSkills: 'Excel',
      jobRequirements: ['Word'],
      jobTitle: 'Admin',
    });
    // total still comes from the local pass, so the score can never disagree
    // with it; the AI only adds to what already matched.
    expect(result.explanation).toBe('Word is Office software.');
    expect(result.score).toBe(100);
    expect(result.matchedItems).toEqual(['Excel', 'Word']);
  });

  it('does not call Gemini at all when the local pass already matched everything', async () => {
    const result = await aiSkillMatch('Excel, Word', ['Excel', 'Word'], 'Admin');

    expect(callEdgeFunction).not.toHaveBeenCalled();
    expect(result.matched).toBe(2);
    expect(result.total).toBe(2);
    expect(result.score).toBe(100);
    expect(result.basicScore).toBe(100);
    expect(result.matchedItems).toEqual(['Excel', 'Word']);
    expect(result.missingItems).toEqual([]);
    // Nothing to analyse, so nothing to say — the card omits its "Match
    // analysis" line rather than inventing a reason for a decision no AI was
    // involved in.
    expect(result.explanation).toBe('');
  });

  it('keeps a local match the model did not mention', async () => {
    // The model was only asked about the misses, so it never saw "Excel".
    callEdgeFunction.mockResolvedValue({
      matchedItems: [],
      missingItems: ['Word'],
      explanation: 'No overlap found.',
    });

    const result = await aiSkillMatch('Excel', ['Excel', 'Word'], 'Admin');

    expect(result.matchedItems).toEqual(['Excel']);
    expect(result.missingItems).toEqual(['Word']);
    expect(result.score).toBe(50);
  });

  it('never counts the same requirement twice', async () => {
    // The model is not asked about "Excel", so answering with it anyway is a
    // mistake — one that would overcount the score and give the chip list two
    // identical keys.
    callEdgeFunction.mockResolvedValue({
      matchedItems: ['Excel', 'Word'],
      missingItems: [],
      explanation: 'Both match.',
    });

    const result = await aiSkillMatch('Excel', ['Excel', 'Word'], 'Admin');

    expect(result.matchedItems).toEqual(['Excel', 'Word']);
    expect(result.matched).toBe(2);
    expect(result.score).toBe(100);
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

    // One requirement the local pass could not match, so there is a question
    // to ask — and the call is the thing that fails.
    const result = await aiSkillMatch('Excel', ['Excel', 'Word'], 'Admin');

    expect(result.explanation).toContain('basic match');
    expect(result.basicScore).toBe(50);
    expect(result.matchedItems).toEqual(['Excel']);
    expect(result.missingItems).toEqual(['Word']);
  });

  it('returns an empty result when the job asks for nothing', async () => {
    const result = await aiSkillMatch('Excel', [], 'Admin');

    expect(result.score).toBe(0);
    expect(callEdgeFunction).not.toHaveBeenCalled();
  });
});
