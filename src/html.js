const entities = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => entities[character])
}

export function validateLink(href) {
  if (typeof href !== 'string' || /[\s\\\u0000-\u001f\u007f]/.test(href)) {
    throw new TypeError('A link must be root-relative or an absolute HTTPS URL')
  }

  if (href.startsWith('/') && !href.startsWith('//')) {
    return href
  }

  if (/^https:\/\/[^/]/i.test(href)) {
    try {
      const url = new URL(href)
      if (url.hostname && !url.username && !url.password) return href
    } catch {}
  }
  throw new TypeError('A link must be root-relative or an absolute HTTPS URL without credentials')
}
