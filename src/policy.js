import { escapeHtml, validateLink } from './html.js'

const controller = {
  name: 'Łukasz Ziaja',
  tradingName: 'AppsByLuke',
  address: 'al. Wiśniowa 36a/304, 53-137 Wrocław, Poland',
  email: 'luke@appsbyluke.com',
}

const controllerCopy = {
  tradingAs: 'trading as',
  registeredAddress: 'Registered address',
  emailLabel: 'Email',
}

const termsCopy = { ...controllerCopy, controllerHeading: 'Who provides the service' }

const privacyCopy = {
  ...controllerCopy,
  controllerHeading: 'Who controls your data',
  analyticsHeading: 'Analytics and privacy choices',
  analyticsDisabled: 'Analytics is currently off on this site.',
  analyticsOptIn: 'Analytics is optional. We use it only after you accept it. You can change or withdraw your consent at any time using Privacy choices.',
  analyticsConsentBasis: 'We rely on your consent to process analytics data.',
  analyticsNotice: 'You can turn off analytics at any time using Privacy choices.',
  analyticsRememberChoice: 'Your browser remembers your choice until you change it or clear the site’s data.',
  analyticsPurpose: 'Why we measure visits',
  analyticsData: 'What we collect',
  analyticsRetention: 'How long we keep it',
  analyticsRecipients: 'Who receives the data',
  analyticsTransfers: 'International transfers',
  rightsHeading: 'Your privacy rights',
  rightsDescription: 'Contact us to ask for access to your data, correct it, have it erased, restrict its use, object to processing or request a portable copy where those rights apply. Withdrawing consent does not affect processing that took place before you withdrew it.',
  complaintLabel: 'Complain to the Polish Personal Data Protection Office (UODO)',
}

const analyticsFields = {
  purpose: 'analyticsPurpose',
  data: 'analyticsData',
  retention: 'analyticsRetention',
  recipients: 'analyticsRecipients',
  transfers: 'analyticsTransfers',
}

function requireText(value, field) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    /\[(?:input|placeholder|insert|replace)\b[^\]]*\]|^(?:(?:tbd|todo|placeholder|to be determined)(?:[.!?]*$|\s*[:\-\u2013\u2014])|…$|\.\.\.$)/i.test(value.trim())
  ) {
    throw new TypeError(`${field} must contain published text`)
  }
}

function validateDocument(document, defaultCopy) {
  requireText(document?.title, 'title')
  requireText(document?.intro, 'intro')

  if (!Array.isArray(document.sections) || document.sections.length === 0) {
    throw new TypeError('At least one published section is required')
  }

  for (const section of document.sections) {
    requireText(section?.heading, 'section heading')
    if (!Array.isArray(section.paragraphs) || section.paragraphs.length === 0) {
      throw new TypeError('Each section needs at least one published paragraph')
    }
    for (const paragraph of section.paragraphs) {
      requireText(paragraph, 'section paragraph')
    }
    if (section.links !== undefined) {
      if (!Array.isArray(section.links)) {
        throw new TypeError('Section links must be an array')
      }
      for (const link of section.links) {
        requireText(link?.label, 'link label')
        validateLink(link?.href)
      }
    }
  }

  if (document.copy === undefined) {
    return defaultCopy
  }
  return Object.fromEntries(Object.keys(defaultCopy).map(key => {
    const value = document.copy?.[key]
    requireText(value, `copy.${key}`)
    return [key, escapeHtml(value)]
  }))
}

function validateAnalytics(policy) {
  const analytics = policy?.analytics
  if (analytics === undefined || analytics?.enabled === false) {
    return null
  }
  if (analytics?.enabled !== true) {
    throw new TypeError('analytics.enabled must be a boolean')
  }

  if (typeof analytics.version !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(analytics.version)) {
    throw new TypeError('analytics.version must be a valid policy revision')
  }
  const mode = analytics.mode ?? 'opt-in'
  if (mode !== 'opt-in' && mode !== 'notice') {
    throw new TypeError('analytics.mode must be opt-in or notice')
  }
  if (mode === 'notice') {
    requireText(analytics.basis, 'analytics.basis')
  }
  for (const field of Object.keys(analyticsFields)) {
    requireText(analytics[field], `analytics.${field}`)
  }
  return analytics.version
}

export function analyticsPolicyVersion(policy) {
  const version = validateAnalytics(policy)
  if (version !== null) {
    validateDocument(policy, privacyCopy)
  }
  return version
}

function renderController(copy) {
  return `<section>
    <h2>${copy.controllerHeading}</h2>
    <p>${controller.name}, ${copy.tradingAs} ${controller.tradingName}. ${copy.registeredAddress}: ${controller.address}.</p>
    <p>${copy.emailLabel} <a href="mailto:${controller.email}">${controller.email}</a>.</p>
  </section>`
}

function renderSections(sections) {
  return sections.map(({ heading, paragraphs, links = [] }) => {
    const items = links.map(({ label, href }) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`)
    return `<section>
      <h2>${escapeHtml(heading)}</h2>
      ${paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('\n')}
      ${items.length ? `<ul>${items.join('')}</ul>` : ''}
    </section>`
  }).join('\n')
}

function renderAnalytics(analytics, copy, version) {
  if (version === null) {
    return `<section><h2>${copy.analyticsHeading}</h2><p>${copy.analyticsDisabled}</p></section>`
  }
  const details = Object.entries(analyticsFields).map(([field, label]) =>
    `<dt>${copy[label]}</dt><dd>${escapeHtml(analytics[field])}</dd>`)
  const notice = analytics.mode === 'notice'
  const choice = notice ? copy.analyticsNotice : copy.analyticsOptIn
  const basis = notice ? escapeHtml(analytics.basis) : copy.analyticsConsentBasis
  return `<section>
    <h2>${copy.analyticsHeading}</h2>
    <p>${choice}</p>
    <p>${basis}</p>
    <p>${copy.analyticsRememberChoice}</p>
    <dl>${details.join('\n')}</dl>
  </section>`
}

export function renderPrivacy(policy) {
  const version = validateAnalytics(policy)
  const copy = validateDocument(policy, privacyCopy)
  return `<article class="abl-legal">
    <h1>${escapeHtml(policy.title)}</h1>
    <p>${escapeHtml(policy.intro)}</p>
    ${renderController(copy)}
    ${renderSections(policy.sections)}
    ${renderAnalytics(policy.analytics, copy, version)}
    <section>
      <h2>${copy.rightsHeading}</h2>
      <p>${copy.rightsDescription}</p>
      <p><a href="https://www.uodo.gov.pl/pl/504/2246">${copy.complaintLabel}</a></p>
    </section>
  </article>`
}

export function renderTerms(terms) {
  const copy = validateDocument(terms, termsCopy)
  return `<article class="abl-legal">
    <h1>${escapeHtml(terms.title)}</h1>
    <p>${escapeHtml(terms.intro)}</p>
    ${renderController(copy)}
    ${renderSections(terms.sections)}
  </article>`
}
