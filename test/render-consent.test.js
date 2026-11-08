import assert from 'node:assert/strict';
import test from 'node:test';
import { renderConsent, renderPrivacyChoices } from '../src/render-consent.js';

const policy = {
  title: 'Privacy policy',
  intro: 'How this site handles data.',
  sections: [{ heading: 'Hosting', paragraphs: ['Example hosting details.'] }],
  analytics: {
    enabled: true,
    version: '2026-11',
    purpose: 'Count visits and see which pages are useful.',
    data: 'Pages and broad device information.',
    retention: 'Up to one month.',
    recipients: 'Example hosting provider.',
    transfers: 'Example deployment within the EEA.',
  },
};

const polishCopy = {
  privacy: 'Polityka prywatności',
  initialTitle: 'Analityka jest wyłączona do czasu wyboru.',
  allowedTitle: 'Analityka jest włączona.',
  declinedTitle: 'Analityka jest wyłączona.',
  noticeTitle: 'Opcjonalna analityka jest włączona.',
  disabledTitle: 'Ta strona nie korzysta z analityki.',
  description: 'Opcjonalna analityka pomaga liczyć wizyty.',
  noticeDescription: 'Możesz wyłączyć analitykę w każdej chwili.',
  disabledDescription: 'Sprawdź szczegóły w polityce prywatności.',
  accept: 'Zezwól',
  decline: 'Odmów',
  keepAllowed: 'Pozostaw włączoną',
  keepOff: 'Pozostaw wyłączoną',
  withdraw: 'Wycofaj zgodę',
  close: 'Zamknij',
  storageError: 'Przeglądarka nie zapisała Twojego wyboru.',
};

test('renders the published opt-in policy with equal choice markup and a local link', () => {
  const html = renderConsent({ policy });
  assert.match(html, /id="privacy-choices" role="dialog" aria-labelledby="abl-consent-title"/);
  assert.match(html, /aria-describedby="abl-consent-description"/);
  assert.match(html, /data-abl-consent-mode="opt-in"/);
  assert.match(html, /data-abl-consent-version="2026-11"/);
  assert.match(html, /<button class="abl-consent-choice" type="button" data-abl-consent-accept>Accept analytics<\/button>/);
  assert.match(html, /<button class="abl-consent-choice" type="button" data-abl-consent-decline>Decline analytics<\/button>/);
  assert.match(html, /<a href="\/privacy">Privacy policy<\/a>/);
  assert.doesNotMatch(html, /abl-analytics-consent|<script|\bstyle=/i);
});

test('keeps disabled consent informative and removes the choice buttons', () => {
  const html = renderConsent({ policy: { ...policy, analytics: { enabled: false } } });
  assert.match(html, /data-abl-consent-version=""/);
  assert.match(html, /Analytics is off on this site/);
  assert.match(html, /data-abl-consent-close>Close<\/button>/);
  assert.match(html, /<a href="\/privacy">Privacy policy<\/a>/);
  assert.doesNotMatch(html, /data-abl-consent-(?:accept|decline)>/);
});

test('derives notice from an explicit published policy and rejects a mismatched mode', () => {
  const noticePolicy = {
    ...policy,
    analytics: { ...policy.analytics, mode: 'notice', basis: 'Verified notice-mode basis for this fixture.' },
  };
  const html = renderConsent({ policy: noticePolicy });
  assert.match(html, /data-abl-consent-mode="notice"/);
  assert.match(html, />Optional analytics is on\.<\/h2>/);
  assert.throws(() => renderConsent({ policy: noticePolicy, mode: 'opt-in' }), /must match/);
});

test('requires a local privacy path and safely escapes localized copy and links', () => {
  for (const href of ['//example.org', '/\\example.org', '/%2fexample.org', 'https://example.org/privacy', '/\texample.org']) {
    assert.throws(() => renderConsent({ policy, policyHref: href }), /same-site path/);
  }
  const html = renderConsent({
    policy,
    policyHref: '/pl/prywatnosc?x=1&y=2',
    copy: { ...polishCopy, privacy: '<Prywatność>', storageError: 'Błąd "zapisu".' },
  });
  assert.match(html, /href="\/pl\/prywatnosc\?x=1&amp;y=2">&lt;Prywatność&gt;/);
  assert.match(html, /data-abl-consent-storage-error="Błąd &quot;zapisu&quot;\."/);
  assert.throws(() => renderConsent({ policy, copy: { privacy: 'Polityka prywatności' } }), /Invalid consent copy/);
  assert.throws(() => renderConsent({ policy, copy: { ...polishCopy, description: 'abl-analytics-consent' } }), /Invalid consent copy/);
});

test('renders a local footer opener with escaped text', () => {
  assert.equal(renderPrivacyChoices(), '<a href="#privacy-choices" data-abl-consent-open>Privacy choices</a>');
  assert.equal(
    renderPrivacyChoices({ label: '<Privacy & choices>' }),
    '<a href="#privacy-choices" data-abl-consent-open>&lt;Privacy &amp; choices&gt;</a>',
  );
});
