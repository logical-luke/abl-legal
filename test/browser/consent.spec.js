import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const key = 'abl-analytics-consent';
const prompt = (page) => page.getByRole('dialog');
const accept = (page) => prompt(page).locator('[data-abl-consent-accept]');
const decline = (page) => prompt(page).locator('[data-abl-consent-decline]');
const opener = (page) => page.getByRole('link', { name: 'Privacy choices' });
const stored = (page) => page.evaluate((name) => localStorage.getItem(name), key);

async function visit(page, url = '/') {
  const response = await page.goto(url);
  expect(response?.ok()).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-analytics-ready', 'true');
  return response;
}

function monitor(page) {
  const hits = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/test-analytics') hits.push(request.method());
  });
  return hits;
}

test('shows equal choices and a working privacy link under strict CSP', async ({ page }) => {
  const violations = [];
  await page.exposeFunction('reportCspViolation', (directive) => violations.push(directive));
  await page.addInitScript(() => {
    window.addEventListener('securitypolicyviolation', (event) => {
      void window.reportCspViolation(event.violatedDirective);
    });
  });
  const hits = monitor(page);
  const response = await visit(page);
  const csp = response.headers()['content-security-policy'];
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("style-src 'self'");
  expect(csp).not.toContain('unsafe-inline');

  await expect(prompt(page)).toBeVisible();
  await expect(prompt(page)).not.toContainText(key);
  await expect(accept(page)).toHaveAccessibleName('Accept analytics');
  await expect(decline(page)).toHaveAccessibleName('Decline analytics');
  const treatment = (button) => button.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.color, style.backgroundColor, style.fontWeight, style.borderColor];
  });
  expect(await treatment(accept(page))).toEqual(await treatment(decline(page)));
  expect(hits).toEqual([]);

  const policyLink = prompt(page).getByRole('link', { name: 'Privacy policy' });
  await expect(policyLink).toHaveAttribute('href', '/privacy');
  await policyLink.click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole('main')).toContainText('Privacy policy');
  await expect(page.getByRole('main')).toContainText('Łukasz Ziaja');
  expect(violations).toEqual([]);
});

test('Escape dismisses without a choice and restores focus to the footer control', async ({ page }) => {
  await visit(page);
  await accept(page).focus();
  await page.keyboard.press('Escape');
  await expect(prompt(page)).toBeHidden();
  expect(await stored(page)).toBeNull();

  await opener(page).focus();
  await page.keyboard.press('Enter');
  await expect(prompt(page)).toBeVisible();
  await expect(accept(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(prompt(page)).toBeHidden();
  await expect(opener(page)).toBeFocused();
  expect(await stored(page)).toBeNull();
});

test('starts after acceptance, reloads the grant and stops after withdrawal', async ({ page }) => {
  const hits = monitor(page);
  await visit(page);
  expect(hits).toHaveLength(0);
  await accept(page).click();
  await expect(prompt(page)).toBeHidden();
  await expect.poll(() => hits.length).toBe(1);
  expect(await stored(page)).toBe('accepted:opt-in:v1');

  await page.reload();
  await expect(prompt(page)).toBeHidden();
  await expect.poll(() => hits.length).toBe(2);
  await opener(page).click();
  await decline(page).click();
  await expect(prompt(page)).toBeHidden();
  expect(await stored(page)).toBe('declined');
  await page.getByRole('button', { name: 'Measure another view' }).click();
  await page.reload();
  await expect(prompt(page)).toBeHidden();
  expect(hits).toHaveLength(2);
});

for (const previous of ['accepted', 'accepted:v1', 'accepted:opt-in:v1']) {
  test(`requires a new grant after saved ${previous} on a revised policy`, async ({ page }) => {
    await page.addInitScript(({ name, value }) => localStorage.setItem(name, value), { name: key, value: previous });
    const hits = monitor(page);
    await visit(page, '/?scenario=updated');
    await expect(prompt(page)).toBeVisible();
    expect(hits).toHaveLength(0);
    await accept(page).click();
    await expect.poll(() => hits.length).toBe(1);
    expect(await stored(page)).toBe('accepted:opt-in:v2');
  });
}

test('honors a decline after the policy is revised', async ({ page }) => {
  const hits = monitor(page);
  await visit(page);
  await decline(page).click();
  expect(await stored(page)).toBe('declined');
  await visit(page, '/?scenario=updated');
  await expect(prompt(page)).toBeHidden();
  expect(hits).toHaveLength(0);
});

test('fails closed when browser storage refuses the grant', async ({ page }) => {
  await page.addInitScript((name) => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (candidate, value) {
      if (candidate === name) throw new Error('Blocked storage');
      setItem.call(this, candidate, value);
    };
  }, key);
  const hits = monitor(page);
  await visit(page);
  await accept(page).click();
  await expect(prompt(page)).toBeVisible();
  await expect(prompt(page).getByRole('status')).not.toBeEmpty();
  expect(await stored(page)).toBeNull();
  expect(hits).toHaveLength(0);
});

test('turns analytics off when withdrawal cannot be saved and removes the stored grant', async ({ page }) => {
  await page.addInitScript((name) => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (candidate, value) {
      if (candidate === name && value === 'declined') throw new Error('Blocked withdrawal write');
      setItem.call(this, candidate, value);
    };
  }, key);
  const hits = monitor(page);
  await visit(page);
  await accept(page).click();
  await expect.poll(() => hits.length).toBe(1);
  await opener(page).click();
  await decline(page).click();
  await expect(prompt(page).getByRole('status')).not.toBeEmpty();
  await expect(page.locator('html')).toHaveAttribute('data-grant', 'false');
  expect(await stored(page)).toBeNull();
  await page.getByRole('button', { name: 'Measure another view' }).click();
  await page.reload();
  await expect(prompt(page)).toBeVisible();
  expect(hits).toHaveLength(1);
});

test('ignores a matching stored grant while browser storage refuses removal', async ({ page }) => {
  await page.addInitScript((name) => {
    localStorage.setItem(name, 'accepted:opt-in:v1');
    Storage.prototype.removeItem = () => { throw new Error('Blocked storage removal'); };
  }, key);
  const hits = monitor(page);
  await visit(page);
  await expect(prompt(page)).toBeVisible();
  expect(hits).toHaveLength(0);
});

test('a disabled policy cannot send events or create a grant', async ({ page }) => {
  await page.addInitScript((name) => localStorage.setItem(name, 'accepted:opt-in:v1'), key);
  const hits = monitor(page);
  await visit(page, '/?scenario=off');
  await expect(prompt(page)).toBeHidden();
  await opener(page).click();
  await expect(prompt(page)).toBeVisible();
  await expect(prompt(page)).toContainText(/analytics is (currently )?off/i);
  await expect(accept(page)).toHaveCount(0);
  await expect(decline(page)).toHaveCount(0);
  await expect(prompt(page).getByRole('link', { name: 'Privacy policy' })).toBeVisible();
  await prompt(page).locator('[data-abl-consent-close]').click();
  expect(await stored(page)).toBe('accepted:opt-in:v1');
  expect(hits).toHaveLength(0);
});

test('synchronizes a grant and withdrawal across tabs', async ({ context, page }) => {
  const second = await context.newPage();
  const firstHits = monitor(page);
  const secondHits = monitor(second);
  await visit(page);
  await visit(second);

  await accept(page).click();
  await expect.poll(() => firstHits.length).toBe(1);
  await expect.poll(() => secondHits.length).toBe(1);

  await opener(page).click();
  await decline(page).click();
  await expect(second.locator('html')).toHaveAttribute('data-grant', 'false');
  expect(await stored(second)).toBe('declined');
  await second.getByRole('button', { name: 'Measure another view' }).click();
  expect(secondHits).toHaveLength(1);
  await second.reload();
  await expect(prompt(second)).toBeHidden();
  await second.getByRole('button', { name: 'Measure another view' }).click();
  expect(secondHits).toHaveLength(1);
});

test('explicit notice can opt out and remains off after reloading', async ({ page }) => {
  const hits = monitor(page);
  await visit(page, '/?scenario=notice');
  await expect.poll(() => hits.length).toBe(1);
  if (!(await prompt(page).isVisible())) await opener(page).click();
  await expect(prompt(page).getByRole('link', { name: 'Privacy policy' })).toBeVisible();
  await decline(page).click();
  expect(await stored(page)).toBe('declined');
  await page.reload();
  await expect(prompt(page)).toBeHidden();
  expect(hits).toHaveLength(1);
});

test('requires opt-in after a notice grant on the same revision', async ({ page }) => {
  const hits = monitor(page);
  await visit(page, '/?scenario=notice');
  await expect(prompt(page)).toBeVisible();
  await accept(page).click();
  expect(await stored(page)).toBe('accepted:notice:v1');

  const beforeOptIn = hits.length;
  await visit(page);
  await expect(prompt(page)).toBeVisible();
  expect(hits).toHaveLength(beforeOptIn);
  await accept(page).click();
  await expect.poll(() => hits.length).toBe(beforeOptIn + 1);
  expect(await stored(page)).toBe('accepted:opt-in:v1');
});

test('starts a matching grant after late initialization and signals changes on remount', async ({ page }) => {
  await page.addInitScript((name) => localStorage.setItem(name, 'accepted:opt-in:v1'), key);
  const hits = monitor(page);
  await visit(page, '/?scenario=late-mount');
  const insert = page.getByRole('button', { name: 'Insert consent' });
  const initialize = page.getByRole('button', { name: 'Initialize consent' });
  const remove = page.getByRole('button', { name: 'Remove consent' });
  const root = page.locator('[data-test-consent-mount] [data-abl-consent]');
  const html = page.locator('html');

  await expect(root).toHaveCount(0);
  expect(hits).toHaveLength(0);
  await insert.click();
  await expect(root).toHaveCount(1);
  expect(hits).toHaveLength(0);
  await initialize.click();
  await expect(html).toHaveAttribute('data-grant', 'true');
  await expect.poll(() => hits.length).toBe(1);
  await initialize.click();
  expect(hits).toHaveLength(1);

  await remove.click();
  await expect(html).toHaveAttribute('data-grant', 'false');
  await page.getByRole('button', { name: 'Measure another view' }).click();
  expect(hits).toHaveLength(1);
  await insert.click();
  expect(hits).toHaveLength(1);
  await initialize.click();
  await expect(html).toHaveAttribute('data-grant', 'true');
  await expect.poll(() => hits.length).toBe(2);
  await expect(prompt(page)).toBeHidden();
});

for (const theme of ['light', 'dark']) {
  test(`has no axe violations in the ${theme} theme`, async ({ page }) => {
    await visit(page, `/?theme=${theme}`);
    await expect(prompt(page)).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map(({ id, nodes }) => [id, nodes.map(({ target }) => target)])).toEqual([]);
  });
}
