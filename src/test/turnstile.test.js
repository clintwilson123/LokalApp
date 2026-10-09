import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Unit tests for the Turnstile helpers: configuration, script loading and the
// widget handle (token, reset, expiry). No network access — the official
// script is simulated with load/error events.

async function loadModule() {
  vi.resetModules();
  return import('../lib/turnstile');
}

describe('site key configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Test 8 — reports CAPTCHA as unconfigured when the site key is missing', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    const turnstile = await loadModule();
    expect(turnstile.getTurnstileSiteKey()).toBe('');
    expect(turnstile.isTurnstileConfigured()).toBe(false);
  });

  it('is configured when a site key is present (trimmed)', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '  1x00000000000000000000AA ');
    const turnstile = await loadModule();
    expect(turnstile.getTurnstileSiteKey()).toBe('1x00000000000000000000AA');
    expect(turnstile.isTurnstileConfigured()).toBe(true);
  });
});

describe('loadTurnstileScript', () => {
  beforeEach(() => {
    document
      .querySelectorAll('script[data-cjlink-turnstile]')
      .forEach((s) => s.remove());
    delete window.turnstile;
  });

  afterEach(() => {
    delete window.turnstile;
  });

  it('resolves immediately when the API is already present', async () => {
    const existing = { render: vi.fn() };
    window.turnstile = existing;
    const turnstile = await loadModule();
    await expect(turnstile.loadTurnstileScript()).resolves.toBe(existing);
  });

  it('injects Cloudflare’s official script and resolves on load', async () => {
    const turnstile = await loadModule();
    const promise = turnstile.loadTurnstileScript();

    const script = document.querySelector('script[data-cjlink-turnstile]');
    expect(script).not.toBeNull();
    expect(script.src).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js');

    window.turnstile = { render: vi.fn() };
    script.dispatchEvent(new Event('load'));
    await expect(promise).resolves.toBe(window.turnstile);
  });

  it('rejects when the script fails to load (fail closed for callers)', async () => {
    const turnstile = await loadModule();
    const promise = turnstile.loadTurnstileScript();
    const script = document.querySelector('script[data-cjlink-turnstile]');
    script.dispatchEvent(new Event('error'));
    await expect(promise).rejects.toThrow(/failed to load the turnstile script/i);
  });
});

describe('renderTurnstile', () => {
  afterEach(() => {
    delete window.turnstile;
    vi.unstubAllEnvs();
  });

  it('exposes the token and notifies the page when it changes', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key-1');
    const reset = vi.fn();
    const remove = vi.fn();
    window.turnstile = { render: vi.fn(() => 'widget-1'), reset, remove };

    const turnstile = await loadModule();
    const onTokenChange = vi.fn();
    const container = document.createElement('div');
    const handle = await turnstile.renderTurnstile(container, { onTokenChange });

    const options = window.turnstile.render.mock.calls[0][1];
    expect(options.sitekey).toBe('site-key-1');

    options.callback('token-abc');
    expect(handle.getToken()).toBe('token-abc');
    expect(onTokenChange).toHaveBeenCalledWith('token-abc');

    handle.remove();
    expect(remove).toHaveBeenCalledWith('widget-1');
  });

  it('Test 7 — clears the token, notifies the page and re-renders on expiry', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key-1');
    const reset = vi.fn();
    window.turnstile = { render: vi.fn(() => 'widget-1'), reset, remove: vi.fn() };

    const turnstile = await loadModule();
    const container = document.createElement('div');
    const onExpired = vi.fn();
    const handle = await turnstile.renderTurnstile(container, { onExpired });

    const options = window.turnstile.render.mock.calls[0][1];
    options.callback('token-abc');
    expect(handle.getToken()).toBe('token-abc');

    options['expired-callback']();
    expect(handle.getToken()).toBe('');
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledWith('widget-1');
  });

  it('clears the token through reset() after a rejected attempt', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key-1');
    const reset = vi.fn();
    window.turnstile = { render: vi.fn(() => 'widget-1'), reset, remove: vi.fn() };

    const turnstile = await loadModule();
    const container = document.createElement('div');
    const handle = await turnstile.renderTurnstile(container, {});

    const options = window.turnstile.render.mock.calls[0][1];
    options.callback('stale-token');
    handle.reset();

    expect(handle.getToken()).toBe('');
    expect(reset).toHaveBeenCalledWith('widget-1');
  });

  it('keeps the token empty when the provider reports an error', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key-1');
    window.turnstile = { render: vi.fn(() => 'widget-1'), reset: vi.fn(), remove: vi.fn() };

    const turnstile = await loadModule();
    const container = document.createElement('div');
    const handle = await turnstile.renderTurnstile(container, {});

    const options = window.turnstile.render.mock.calls[0][1];
    options['error-callback']();
    expect(handle.getToken()).toBe('');
  });

  it('rejects without a container instead of pretending success', async () => {
    const turnstile = await loadModule();
    await expect(turnstile.renderTurnstile(null, {})).rejects.toThrow(/container/i);
  });
});
