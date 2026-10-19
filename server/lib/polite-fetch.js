// Requests to publishers, as the Phase 5 scripts make them (size-downloads.js lists and measures, fetch-downloads.js
// saves): who we say we are, and how fast we ask.

// A contact address goes in the User-Agent only where the publisher requires one (BLS; user, 2026-10-13).
// Elsewhere a standard browser string, still naming GovGraph at the end: ed.gov's Azure firewall, acf.gov and the
// USDA local food portal refuse any User-Agent that is not a browser's (user, 2026-10-18). Sites behind Akamai or a
// Cloudflare challenge refuse it too; they are not bypassed.
const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 govgraph-research';

export const headersFor = url => ({
  'User-Agent': /(^|\.)bls\.gov$/.test(new URL(url).hostname) && process.env.BLS_CONTACT_EMAIL
    ? `govgraph public records research (${process.env.BLS_CONTACT_EMAIL})`
    : BROWSER,
});

// Per host: two requests at a time, starts 500 ms apart, unless the host asks for less. OECD's API allows about
// twenty data queries an hour (429 after that, 2026-10-18).
const LIMITS = { 'sdmx.oecd.org': { active: 1, gap: 200000 } };
const hosts = new Map();

/** Run `fn` (one request, or a whole download) in its host's turn; retried on 429 and 503, backing off. */
export async function polite(url, fn) {
  const host = new URL(url).hostname;
  const { active = 2, gap = 500 } = LIMITS[host] ?? {};
  const h = hosts.get(host) ?? hosts.set(host, { active: 0, last: 0, waiting: [] }).get(host);
  while (h.active >= active) await new Promise(resolve => h.waiting.push(resolve));
  h.active++;
  try {
    for (let attempt = 1; ; attempt++) {
      const wait = h.last + gap - Date.now();
      h.last = Date.now() + Math.max(0, wait);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      const res = await fn();
      if ((res.status === 429 || res.status === 503) && attempt <= 6) {
        await new Promise(r => setTimeout(r, 2000 * 2 ** attempt));
        continue;
      }
      return res;
    }
  } finally {
    h.active--;
    h.waiting.shift()?.();
  }
}

/** fetch() in its host's turn; a network failure comes back as status 0 with `error`. */
export const request = (url, init = {}, timeout = 60000) => polite(url, () =>
  fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeout), ...init, headers: { ...headersFor(url), ...init.headers } })
    .catch(err => ({ status: 0, ok: false, headers: new Headers(), error: err.cause?.code ?? err.message, body: null })));

/** Whether an HTML answer is the file itself: a page address, or a page saved on purpose (`name: '….html'`).
 *  Elsewhere HTML is an error or challenge page (BEA answers a missing file with a page and 200). */
export const htmlExpected = (url, name) =>
  /\.html?$/.test(name ?? '') || /\.(s?html?|cfm|aspx?|php)$|\/$/i.test(new URL(url).pathname);
