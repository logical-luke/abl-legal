const storageKey = 'abl-analytics-consent';
const storageCheckKey = 'abl-analytics-consent-storage-check';
const consentEvent = 'abl:analytics-consent';
const versionPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

let fallbackChoice = null;
let pendingWithdrawal = false;
let mountedRoot = null;
let mountedMode = null;
let mountedVersion = null;
let opener = null;
let listenersInstalled = false;

function configuration() {
  if (typeof document === 'undefined') return null;
  const roots = document.querySelectorAll('[data-abl-consent]');
  if (roots.length !== 1) return null;

  const root = roots[0];
  const { ablConsentMode: mode, ablConsentVersion: version } = root.dataset;
  const enabled = (mode === 'opt-in' || mode === 'notice') && versionPattern.test(version ?? '');
  return { root, mode, version: enabled ? version : null };
}

function grantValue(config) {
  return `accepted:${config.mode}:${config.version}`;
}

function parseChoice(value, config) {
  if (value === 'declined') return 'declined';
  return value === grantValue(config) ? 'accepted' : null;
}

function storedChoice(config) {
  try {
    const storage = window.localStorage;
    let choice = parseChoice(storage.getItem(storageKey), config);
    if (choice === 'accepted' || (choice === null && config.mode === 'notice')) {
      storage.removeItem(storageCheckKey);
      choice = parseChoice(storage.getItem(storageKey), config);
    }
    return { choice, available: true };
  } catch {
    return { choice: null, available: false };
  }
}

function saveChoice(choice, config) {
  try {
    const storage = window.localStorage;
    const value = choice === 'accepted' ? grantValue(config) : 'declined';
    if (choice === 'accepted') storage.removeItem(storageCheckKey);
    storage.setItem(storageKey, value);
    return storage.getItem(storageKey) === value;
  } catch {
    return false;
  }
}

function isGrant(value) {
  return value === 'accepted' || value?.startsWith('accepted:');
}

function dispatchChange() {
  window.dispatchEvent(new CustomEvent(consentEvent, { detail: { granted: analyticsAllowed() } }));
}

export function getConsentChoice() {
  const config = configuration();
  if (!config?.version) return null;
  return fallbackChoice ?? storedChoice(config).choice;
}

export function analyticsAllowed() {
  const config = configuration();
  if (!config?.version) return false;

  if (pendingWithdrawal) {
    if (!saveChoice('declined', config)) return false;
    pendingWithdrawal = false;
    fallbackChoice = null;
  }

  if (fallbackChoice !== null) return false;
  const { choice, available } = storedChoice(config);
  return available && (choice === 'accepted' || (config.mode === 'notice' && choice !== 'declined'));
}

export function setConsentChoice(choice) {
  const config = configuration();
  if (!config?.version || (choice !== 'accepted' && choice !== 'declined')) return false;

  let saved = saveChoice(choice, config);
  let grantCleared = false;
  if (!saved && choice === 'declined' && config.mode === 'opt-in') {
    try {
      const storage = window.localStorage;
      if (isGrant(storage.getItem(storageKey))) storage.removeItem(storageKey);
      const current = storage.getItem(storageKey);
      grantCleared = !isGrant(current);
      saved = current === 'declined';
    } catch {}
  }

  pendingWithdrawal = !saved && !grantCleared && (choice === 'declined' || pendingWithdrawal);
  fallbackChoice = saved ? null : 'declined';
  dispatchChange();
  return saved || (choice === 'declined' && fallbackChoice === null);
}

function syncStorage(event) {
  if (event.key !== storageKey && event.key !== null) return;
  try {
    if (event.storageArea && event.storageArea !== window.localStorage) return;
  } catch {
    dispatchChange();
    return;
  }
  if (!pendingWithdrawal) fallbackChoice = null;
  dispatchChange();
}

function render() {
  const config = configuration();
  if (!config?.version) return;
  const { root } = config;
  const { dataset } = root;
  const status = root.querySelector('[data-abl-consent-status]');
  const title = root.querySelector('[data-abl-consent-title]');
  const accept = root.querySelector('[data-abl-consent-accept]');
  const decline = root.querySelector('[data-abl-consent-decline]');
  if (status) status.textContent = '';
  if (!title || !accept || !decline) return;

  const allowed = analyticsAllowed();
  const declined = getConsentChoice() === 'declined';
  const titleText = allowed ? dataset.ablConsentAllowedTitle
    : declined ? dataset.ablConsentDeclinedTitle : dataset.ablConsentInitialTitle;
  const acceptText = allowed ? dataset.ablConsentKeepAllowedLabel : dataset.ablConsentAcceptLabel;
  const declineText = allowed ? dataset.ablConsentWithdrawLabel
    : declined ? dataset.ablConsentKeepOffLabel : dataset.ablConsentDeclineLabel;
  if (titleText !== undefined) title.textContent = titleText;
  if (acceptText !== undefined) accept.textContent = acceptText;
  if (declineText !== undefined) decline.textContent = declineText;
}

function close(root, restoreFocus = true) {
  const focusWasInside = root.contains(document.activeElement);
  root.hidden = true;
  if (restoreFocus) {
    if (opener?.isConnected) {
      opener.focus();
    } else if (focusWasInside) {
      const main = document.querySelector('main');
      if (main) {
        if (!main.hasAttribute('tabindex')) main.tabIndex = -1;
        main.focus({ preventScroll: true });
      }
    }
  }
  opener = null;
}

function choose(root, choice) {
  if (setConsentChoice(choice)) {
    close(root);
    return;
  }

  const status = root.querySelector('[data-abl-consent-status]');
  if (status) status.textContent = root.dataset.ablConsentStorageError ?? '';
}

function handleClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const config = configuration();
  if (!config || !(event.target instanceof Element)) return;
  const { root } = config;
  const trigger = event.target.closest('[data-abl-consent-open]');
  if (root.id && trigger?.getAttribute('href') === `#${root.id}`) {
    event.preventDefault();
    opener = trigger;
    render();
    root.hidden = false;
    const focusTarget = root.querySelector(config.version ? '[data-abl-consent-accept]' : '[data-abl-consent-close]');
    focusTarget?.focus();
    return;
  }

  if (root.hidden) return;
  if (!root.contains(event.target)) {
    close(root, false);
    return;
  }

  if (event.target.closest('[data-abl-consent-close]')) {
    close(root);
  } else if (config.version && event.target.closest('[data-abl-consent-accept]')) {
    if (analyticsAllowed() && getConsentChoice() === 'accepted') close(root);
    else choose(root, 'accepted');
  } else if (config.version && event.target.closest('[data-abl-consent-decline]')) {
    choose(root, 'declined');
  }
}

function handleKeydown(event) {
  const root = configuration()?.root;
  if (event.key !== 'Escape' || !root || root.hidden || !root.contains(document.activeElement)) return;
  event.preventDefault();
  close(root);
}

export function initConsent() {
  if (typeof document === 'undefined') return;
  if (!listenersInstalled) {
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('storage', syncStorage);
    window.addEventListener(consentEvent, render);
    listenersInstalled = true;
  }

  const config = configuration();
  const root = config?.root ?? null;
  const mode = config?.mode ?? null;
  const version = config?.version ?? null;
  if (root === mountedRoot && mode === mountedMode && version === mountedVersion) return;
  const hadRoot = mountedRoot !== null;
  if (mountedRoot && mountedRoot !== root) close(mountedRoot, false);
  mountedRoot = root;
  mountedMode = mode;
  mountedVersion = version;

  render();
  if (root) root.hidden = !version || getConsentChoice() !== null;
  if (hadRoot || version) dispatchChange();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConsent, { once: true });
  } else {
    initConsent();
  }
}
