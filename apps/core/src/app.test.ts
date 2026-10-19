import { describe, expect, it } from 'bun:test';
import { createApp } from './app';

const app = createApp({ corsOrigin: ['http://localhost:3300'] });

describe('GET /health', () => {
  it('reports ok with the package name', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.name).toBe('@fo/core');
  });
});

describe('unknown routes', () => {
  it('answer 404 as JSON', async () => {
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });
});
