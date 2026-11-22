import { describe, expect, it } from 'vitest';
import { dispatch } from '../worker/index.js';

function request(path, method = 'GET') {
  return new Request(`https://example.test${path}`, { method });
}

describe('worker router', () => {
  it('sends ordinary pages to the asset binding', async () => {
    const seen = [];
    const response = await dispatch(request('/terms'), {}, (assetRequest) => {
      seen.push(new URL(assetRequest.url).pathname);
      return new Response('terms', { status: 200 });
    });
    expect(seen).toEqual(['/terms']);
    expect(response.status).toBe(200);
  });

  it('does not serve the paid pack as a static file', async () => {
    let fetched = false;
    const response = await dispatch(request('/report'), { DATA: null }, () => {
      fetched = true;
      return new Response('secret pack', { status: 200 });
    });
    expect(fetched).toBe(false);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/unlock');
  });

  it('rejects the wrong method on checkout', async () => {
    const response = await dispatch(request('/api/checkout', 'GET'), {}, () => new Response('asset'));
    expect(response.status).toBe(405);
  });
});
