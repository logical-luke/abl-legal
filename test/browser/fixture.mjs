import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { renderPrivacy } from '../../src/policy.js';
import { renderConsent, renderPrivacyChoices } from '../../src/render-consent.js';

const headers = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'",
  'X-Content-Type-Options': 'nosniff',
};

const policies = {
  off: { enabled: false },
  notice: { enabled: true, mode: 'notice', basis: 'Test fixture basis', version: 'v1' },
  updated: { enabled: true, version: 'v2' },
};

function policyFor(scenario) {
  return {
    title: 'Privacy policy',
    intro: 'Privacy information for the browser fixture.',
    sections: [{ heading: 'Delivery', paragraphs: ['The fixture delivers this page from the local server.'] }],
    analytics: {
      enabled: true,
      version: 'v1',
      purpose: 'Count pages in the browser test.',
      data: 'Page views.',
      retention: 'For the duration of the test.',
      recipients: 'Local fixture server.',
      transfers: 'No external transfers.',
      ...(Object.hasOwn(policies, scenario) ? policies[scenario] : {}),
    },
  };
}

const analytics = `
import { analyticsAllowed } from '/abl-legal/consent.js';

function record() {
  if (analyticsAllowed()) void fetch('/test-analytics', { method: 'POST' });
}

window.addEventListener('abl:analytics-consent', (event) => {
  document.documentElement.dataset.grant = String(event.detail.granted);
  if (event.detail.granted) record();
});
document.querySelector('[data-test-measure]')?.addEventListener('click', record);
record();
document.documentElement.dataset.analyticsReady = 'true';
`;

const fixtureStyle = `
body { background: white; color: #172033; }
body[data-theme="dark"] { background: #13161d; color: #f2f5fb; }
[data-theme="dark"] {
  --abl-consent-surface: #13161d;
  --abl-consent-ink: #f2f5fb;
  --abl-consent-muted: #bfc8d8;
  --abl-consent-line: #aeb7cc;
  --abl-consent-accent: #9bc3ff;
  --abl-consent-focus: #9bc3ff;
}
a { color: inherit; }
`;

function pageHtml({ main, dialog, dark }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Consent browser fixture</title>
  <link rel="stylesheet" href="/abl-legal/consent.css">
  <link rel="stylesheet" href="/fixture.css">
  <script type="module" src="/abl-legal/consent.js"></script>
  <script type="module" src="/analytics-fixture.js"></script>
</head>
<body${dark ? ' data-theme="dark"' : ''}>
  <main tabindex="-1">${main}</main>
  <footer>${renderPrivacyChoices()}</footer>
  ${dialog}
</body>
</html>`;
}

const assets = {
  '/abl-legal/consent.js': ['text/javascript', new URL('../../assets/consent.js', import.meta.url)],
  '/abl-legal/consent.css': ['text/css', new URL('../../assets/consent.css', import.meta.url)],
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const asset = Object.hasOwn(assets, url.pathname) ? assets[url.pathname] : null;
    let contentType = 'text/html; charset=utf-8';
    let body;
    if (asset) {
      [contentType] = asset;
      body = await readFile(asset[1]);
    } else if (url.pathname === '/analytics-fixture.js') {
      contentType = 'text/javascript';
      body = analytics;
    } else if (url.pathname === '/fixture.css') {
      contentType = 'text/css';
      body = fixtureStyle;
    } else if (url.pathname === '/test-analytics' && request.method === 'POST') {
      response.writeHead(204, headers).end();
      return;
    } else if (url.pathname === '/' || url.pathname === '/privacy') {
      const scenario = url.searchParams.get('scenario');
      const policy = policyFor(scenario);
      const search = scenario && Object.hasOwn(policies, scenario) ? `?scenario=${scenario}` : '';
      const main = url.pathname === '/privacy'
        ? renderPrivacy(policy)
        : '<h1>Consent test site</h1><button type="button" data-test-measure>Measure another view</button>';
      body = pageHtml({
        main,
        dialog: renderConsent({ policy, policyHref: `/privacy${search}` }),
        dark: url.searchParams.get('theme') === 'dark',
      });
    } else {
      response.writeHead(404, headers).end();
      return;
    }
    response.writeHead(200, { ...headers, 'Content-Type': contentType }).end(body);
  } catch (error) {
    console.error(error);
    response.writeHead(500, headers).end();
  }
}).listen(4387, '127.0.0.1');
