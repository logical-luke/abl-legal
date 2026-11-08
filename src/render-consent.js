import { escapeHtml, validateLink } from './html.js';
import { analyticsPolicyVersion } from './policy.js';

const defaults = Object.freeze({
  privacy: 'Privacy policy',
  initialTitle: 'Analytics is off until you choose.',
  allowedTitle: 'Analytics is allowed.',
  declinedTitle: 'Analytics is not allowed.',
  noticeTitle: 'Optional analytics is on.',
  disabledTitle: 'Analytics is off on this site.',
  description: 'Optional analytics helps us count visits and see which pages are useful. You can change your choice at any time.',
  noticeDescription: 'Analytics helps us count visits and see which pages are useful. You can turn it off at any time.',
  disabledDescription: 'This site does not send analytics. Read the privacy policy for details.',
  accept: 'Accept analytics',
  decline: 'Decline analytics',
  keepAllowed: 'Keep analytics allowed',
  keepOff: 'Keep analytics off',
  withdraw: 'Withdraw permission',
  close: 'Close',
  storageError: 'Your browser could not save your choice. Analytics is off on this page.',
});

function copyText(value, name) {
  if (typeof value !== 'string' || !value.trim() || /abl-analytics-consent/i.test(value)) {
    throw new TypeError(`Invalid consent copy for ${name}`);
  }
  return value;
}

function consentCopy(copy) {
  if (copy === undefined) return defaults;
  if (!copy || typeof copy !== 'object' || Array.isArray(copy)) throw new TypeError('Invalid consent copy');
  return Object.fromEntries(Object.keys(defaults).map((key) => [key, copyText(copy[key], key)]));
}

function policyLink(href) {
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')
      || /[\\\x00-\x20\x7f]|%2f|%5c/i.test(href)) {
    throw new TypeError('Privacy policy link must use a same-site path');
  }
  validateLink(href);
  return escapeHtml(href);
}

export function renderConsent({ policy, policyHref = '/privacy', mode, copy } = {}) {
  const version = analyticsPolicyVersion(policy);
  const policyMode = policy?.analytics?.mode ?? 'opt-in';
  if (mode !== undefined && mode !== policyMode) throw new TypeError('Consent mode must match the privacy policy');
  if (policyMode !== 'opt-in' && policyMode !== 'notice') throw new TypeError('Invalid consent mode');

  const href = policyLink(policyHref);
  const labels = consentCopy(copy);
  const t = (key) => escapeHtml(labels[key]);
  const enabled = version !== null;
  const notice = policyMode === 'notice';
  const title = enabled ? t(notice ? 'noticeTitle' : 'initialTitle') : t('disabledTitle');
  const description = enabled ? t(notice ? 'noticeDescription' : 'description') : t('disabledDescription');
  const actions = enabled ? `
  <div class="abl-consent-actions">
    <button class="abl-consent-choice" type="button" data-abl-consent-accept>${t('accept')}</button>
    <button class="abl-consent-choice" type="button" data-abl-consent-decline>${t('decline')}</button>
  </div>` : '';

  return `<div class="abl-consent" id="privacy-choices" role="dialog" aria-labelledby="abl-consent-title"
  aria-describedby="abl-consent-description" data-abl-consent data-abl-consent-mode="${policyMode}"
  data-abl-consent-version="${escapeHtml(version ?? '')}" data-abl-consent-allowed-title="${t(notice ? 'noticeTitle' : 'allowedTitle')}"
  data-abl-consent-declined-title="${t('declinedTitle')}" data-abl-consent-initial-title="${t('initialTitle')}"
  data-abl-consent-accept-label="${t('accept')}" data-abl-consent-decline-label="${t('decline')}"
  data-abl-consent-keep-allowed-label="${t('keepAllowed')}" data-abl-consent-keep-off-label="${t('keepOff')}"
  data-abl-consent-withdraw-label="${t('withdraw')}" data-abl-consent-storage-error="${t('storageError')}" hidden>
  <h2 id="abl-consent-title" data-abl-consent-title>${title}</h2>
  <p id="abl-consent-description">${description}</p>
  <p role="status" data-abl-consent-status></p>${actions}
  <div class="abl-consent-links">
    <a href="${href}">${t('privacy')}</a>
    <button class="abl-consent-close" type="button" data-abl-consent-close>${t('close')}</button>
  </div>
</div>`;
}

export function renderPrivacyChoices({ label = 'Privacy choices' } = {}) {
  return `<a href="#privacy-choices" data-abl-consent-open>${escapeHtml(copyText(label, 'choices'))}</a>`;
}
