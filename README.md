# AppsByLuke legal components

Render consent, privacy and terms with one verified controller record. Each site owns its processing disclosures, terms, translations and theme.

## Install a tagged release

```sh
npm install github:logical-luke/abl-legal#v1.0.0
npx abl-legal copy public
```

Commit the copied files with the pinned dependency. Run `npx abl-legal check public` in CI to verify the copies match `node_modules/abl-legal/assets`. The copy command updates only `public/abl-legal/consent.js` and `public/abl-legal/consent.css`.

## Render each component

```js
import { renderConsent, renderPrivacy, renderPrivacyChoices, renderTerms } from 'abl-legal'

const policy = {
  title: 'Privacy policy',
  intro: 'This notice covers this website.',
  sections: [
    { heading: 'Visiting the website', paragraphs: ['Describe verified current processing here.'] },
  ],
  analytics: { enabled: false },
}

renderConsent({ policy, policyHref: '/privacy' })
renderPrivacyChoices({ label: 'Privacy choices' })
renderPrivacy(policy)
renderTerms({
  title: 'Terms of service',
  intro: 'These terms cover this website.',
  sections: [{ heading: 'Using the website', paragraphs: ['Supply the terms approved for this product.'] }],
})
```

The example text is for integration only. Supply verified, publishable copy in each site. The package escapes all text and validates links. Terms and privacy pages use one controller record. They accept product-specific sections, links and complete localized copy dictionaries. The package does not choose subscription, refund or vendor terms for a product.

Render the prompt once near the end of the layout and the Privacy choices control in the footer. Add a footer link to each published legal page. Use Astro `set:html` or Vue `v-html` only with package-generated markup. Load the assets separately in the site layout, including when Vue renders the markup on the client.

```html
<link rel="stylesheet" href="/abl-legal/consent.css">
<script type="module" src="/abl-legal/consent.js"></script>
```

Map `--abl-consent-surface`, `--abl-consent-ink`, `--abl-consent-muted`, `--abl-consent-line`, `--abl-consent-accent` and `--abl-consent-focus` to local light and dark tokens. The assets work with same-origin CSP and need no inline style or script.

## Enable analytics only after publishing the notice

The same policy object must drive the privacy page and consent renderer. When measurement is live, set `analytics.enabled` and supply a policy revision plus the verified purpose, collected data, retention, recipients and transfer details. Use a stable, distinct revision for the consent scope. Update it when the scope changes. Supply a complete localized copy dictionary where English is inappropriate. Describe cookieless or ad-free operation only where verified.

All AppsByLuke sites use opt-in. The package also supports an explicit notice mode for a deployment with a verified applicable basis. The disabled state shows current inactivity, records no grant and cannot start an analytics sender.

Import the same copied browser module URL from the site's external analytics bootstrap. Check the permission before loading or constructing an SDK, and subscribe before checking it. Stop sending on withdrawal. A client ID alone never authorizes analytics.

```js
import { analyticsAllowed } from '/abl-legal/consent.js'

window.addEventListener('abl:analytics-consent', ({ detail }) => {
  if (detail.granted && analyticsAllowed()) startAnalytics()
  else stopAnalytics()
})
if (analyticsAllowed()) startAnalytics()
```

Use idempotent start and stop functions. If starting awaits an SDK import, recheck permission after the import and before creating the SDK. On withdrawal, invalidate any start already in progress. A Vite-managed bootstrap can resolve the copied asset with an ignored dynamic import. Keep the URL identical to the layout's module URL so the prompt and sender share one state instance.

Consent uses one first-party browser value. An accepted choice applies only to its published policy revision and consent mode. A stale, unscoped or notice-mode acknowledgment cannot authorize opt-in measurement. A saved decline carries across revisions. If storage rejects a choice, the current page fails closed.

For Vue client-rendered pages, call the copied module's `initConsent()` after mounting the prompt. For Astro server-rendered layouts the module initializes automatically.

## Verify

Run `npm ci`, `npx playwright install chromium`, then `npm run gate`. The gate exercises renderers, asset copying, browser behavior and package contents.
