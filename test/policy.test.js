import assert from 'node:assert/strict'
import test from 'node:test'
import { escapeHtml, validateLink } from '../src/html.js'
import { analyticsPolicyVersion, renderPrivacy, renderTerms } from '../src/policy.js'

const policy = {
  title: 'Privacy for Tool',
  intro: 'This notice covers Tool.',
  sections: [{ heading: 'Visiting the site', paragraphs: ['Our host delivers the requested page.'] }],
}

const analytics = {
  enabled: true,
  version: 'visits-1.0',
  purpose: 'Understand which pages help visitors.',
  data: 'Pages viewed and device type.',
  retention: 'Analytics data expires after 25 months.',
  recipients: 'Our site infrastructure handles measurement.',
  transfers: 'Analytics data is processed in Germany.',
}

test('an inactive policy renders the shared controller and rights without claiming active measurement', () => {
  assert.equal(analyticsPolicyVersion(policy), null)
  assert.equal(analyticsPolicyVersion({ analytics: { enabled: false } }), null)
  const html = renderPrivacy(policy)
  assert.match(html, /Łukasz Ziaja, trading as AppsByLuke/)
  assert.match(html, /al\. Wiśniowa 36a\/304, 53-137 Wrocław, Poland/)
  assert.match(html, /href="mailto:luke@appsbyluke\.com"/)
  assert.match(html, /Analytics is currently off/)
  assert.match(html, /Your privacy rights/)
  assert.match(html, /https:\/\/www\.uodo\.gov\.pl\/pl\/504\/2246/)
  assert.doesNotMatch(html, /We use it only after you accept it/)
})

test('a published analytics policy renders every supplied fact and opt-in controls', () => {
  const published = { ...policy, analytics }
  assert.equal(analyticsPolicyVersion(published), 'visits-1.0')
  const html = renderPrivacy(published)
  for (const field of ['purpose', 'data', 'retention', 'recipients', 'transfers']) {
    assert.ok(html.includes(analytics[field]), field)
  }
  assert.match(html, /only after you accept it/)
  assert.match(html, /withdraw your consent/)
  assert.doesNotMatch(html, /currently off/)
})

test('notice mode requires an explicit basis and describes an opt-out', () => {
  assert.throws(() => analyticsPolicyVersion({ ...policy, analytics: { ...analytics, mode: 'notice' } }), /analytics\.basis/)
  const notice = {
    ...policy,
    analytics: { ...analytics, mode: 'notice', basis: 'Read the approved & published basis.' },
  }
  assert.equal(analyticsPolicyVersion(notice), 'visits-1.0')
  const html = renderPrivacy(notice)
  assert.match(html, /turn off analytics/)
  assert.match(html, /approved &amp; published basis/)
  assert.doesNotMatch(html, /only after you accept it/)
})

test('a policy with enabled measurement cannot provide a missing, blank or placeholder disclosure', () => {
  for (const field of ['purpose', 'data', 'retention', 'recipients', 'transfers']) {
    for (const value of [undefined, ' ', 'TBD', '[INPUT: verify first]']) {
      assert.throws(() => analyticsPolicyVersion({ ...policy, analytics: { ...analytics, [field]: value } }), new RegExp(`analytics\\.${field}`))
    }
  }
  for (const version of ['', 'policy revision', 'v:1', 'x'.repeat(65)]) {
    assert.throws(() => analyticsPolicyVersion({ ...policy, analytics: { ...analytics, version } }), /policy revision/)
  }
  assert.throws(() => analyticsPolicyVersion({ ...policy, analytics: { ...analytics, mode: 'on' } }), /analytics\.mode/)
  assert.throws(() => analyticsPolicyVersion({ ...policy, analytics: { ...analytics, enabled: 'true' } }), /analytics\.enabled/)
  assert.throws(() => analyticsPolicyVersion({ ...policy, sections: [], analytics }), /published section/)
})

test('terms contain only the common operator details and the supplied product sections', () => {
  const terms = {
    ...policy,
    title: 'Tool terms',
    intro: 'These terms apply to Tool.',
    sections: [{ heading: 'Using Tool', paragraphs: ['Open Tool in your browser.'] }],
  }
  const html = renderTerms(terms)
  assert.match(html, /Tool terms/)
  assert.match(html, /Łukasz Ziaja, trading as AppsByLuke/)
  assert.match(html, /Open Tool in your browser/)
  assert.doesNotMatch(html, /Analytics|privacy rights/)
  assert.throws(() => renderTerms({ ...terms, sections: [{ heading: 'Using Tool', paragraphs: ['[INPUT: fill later]'] }] }), /section paragraph must contain published text/)
})

test('the renderers escape caller text and attributes and reject unsafe link destinations', () => {
  const attack = '<script>alert("x")</script> & it\'s unsafe'
  const html = renderTerms({
    title: attack,
    intro: attack,
    sections: [{
      heading: attack,
      paragraphs: [attack],
      links: [{ label: attack, href: '/privacy?a=1&b=2' }],
    }],
  })
  assert.equal(escapeHtml(attack), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; it&#39;s unsafe')
  assert.ok(html.includes(escapeHtml(attack)))
  assert.match(html, /href="\/privacy\?a=1&amp;b=2"/)
  assert.doesNotMatch(html, /<script>/)
  for (const href of ['//evil.example', '/\\evil.example', '/\n/evil.example', 'javascript:alert(1)', 'http://evil.example', 'https://alice@evil.example']) {
    assert.throws(() => validateLink(href), /HTTPS URL/)
  }
  assert.equal(validateLink('/privacy#choices'), '/privacy#choices')
  assert.equal(validateLink('https://example.com/privacy'), 'https://example.com/privacy')
})

test('a localized privacy policy replaces all common copy and validates the dictionary before enabling', () => {
  const copy = {
    controllerHeading: 'Administrator danych',
    tradingAs: 'działający jako',
    registeredAddress: 'Adres',
    emailLabel: 'Poczta elektroniczna',
    analyticsHeading: 'Statystyki i prywatność',
    analyticsDisabled: 'Statystyki są wyłączone.',
    analyticsOptIn: 'Statystyki działają tylko za Twoją zgodą.',
    analyticsConsentBasis: 'Podstawą przetwarzania jest zgoda.',
    analyticsNotice: 'Możesz wyłączyć statystyki.',
    analyticsRememberChoice: 'Przeglądarka zapamiętuje Twój wybór.',
    analyticsPurpose: 'Cel',
    analyticsData: 'Zakres danych',
    analyticsRetention: 'Okres przechowywania',
    analyticsRecipients: 'Odbiorcy',
    analyticsTransfers: 'Transfery',
    rightsHeading: 'Twoje prawa',
    rightsDescription: 'Możesz poprosić o dostęp do danych.',
    complaintLabel: 'Skarga do UODO <link>',
  }
  const localized = { ...policy, copy }
  const inactive = renderPrivacy(localized)
  assert.match(inactive, /Łukasz Ziaja, działający jako AppsByLuke/)
  assert.match(inactive, /Statystyki są wyłączone/)
  assert.match(inactive, /Skarga do UODO &lt;link&gt;/)
  assert.doesNotMatch(inactive, /Who controls your data|Your privacy rights|Analytics is currently off/)
  const active = renderPrivacy({ ...localized, analytics })
  assert.match(active, /Statystyki działają tylko za Twoją zgodą/)
  assert.match(active, /<dt>Okres przechowywania<\/dt>/)
  assert.doesNotMatch(active, /Analytics is optional|How long we keep it|Statystyki są wyłączone/)
  const invalid = { ...localized, analytics, copy: { ...copy, rightsDescription: undefined } }
  assert.throws(() => analyticsPolicyVersion(invalid), /copy\.rightsDescription/)
  assert.throws(() => renderPrivacy({ ...invalid, analytics: undefined }), /copy\.rightsDescription/)
})

test('localized terms use the complete common copy without privacy or analytics fields', () => {
  const copy = {
    controllerHeading: 'Usługodawca',
    tradingAs: 'działający jako',
    registeredAddress: 'Adres',
    emailLabel: 'Kontakt',
  }
  const html = renderTerms({ ...policy, copy })
  assert.match(html, /<h2>Usługodawca<\/h2>/)
  assert.match(html, /Adres: al\. Wiśniowa/)
  assert.match(html, /Kontakt <a href="mailto:luke@appsbyluke\.com"/)
  assert.throws(() => renderTerms({ ...policy, copy: { ...copy, emailLabel: '' } }), /copy\.emailLabel/)
})
