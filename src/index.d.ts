export interface LegalLink {
  label: string
  href: string
}

export interface LegalSection {
  heading: string
  paragraphs: string[]
  links?: LegalLink[]
}

export interface LegalPage {
  title: string
  intro: string
  sections: LegalSection[]
}

export type AnalyticsPolicy = { enabled: false } | {
  enabled: true
  version: string
  purpose: string
  data: string
  retention: string
  recipients: string
  transfers: string
} & ({ mode?: 'opt-in'; basis?: string } | { mode: 'notice'; basis: string })

export interface TermsCopy {
  controllerHeading: string
  tradingAs: string
  registeredAddress: string
  emailLabel: string
}

export interface PrivacyCopy extends TermsCopy {
  analyticsHeading: string
  analyticsDisabled: string
  analyticsOptIn: string
  analyticsConsentBasis: string
  analyticsNotice: string
  analyticsRememberChoice: string
  analyticsPurpose: string
  analyticsData: string
  analyticsRetention: string
  analyticsRecipients: string
  analyticsTransfers: string
  rightsHeading: string
  rightsDescription: string
  complaintLabel: string
}

export interface PrivacyPolicy extends LegalPage {
  analytics?: AnalyticsPolicy
  copy?: PrivacyCopy
}

export interface ConsentCopy {
  privacy: string
  initialTitle: string
  allowedTitle: string
  declinedTitle: string
  noticeTitle: string
  disabledTitle: string
  description: string
  noticeDescription: string
  disabledDescription: string
  accept: string
  decline: string
  keepAllowed: string
  keepOff: string
  withdraw: string
  close: string
  storageError: string
}

export interface ConsentOptions {
  policy: PrivacyPolicy
  policyHref?: string
  mode?: 'opt-in' | 'notice'
  copy?: ConsentCopy
}

export function renderConsent(options: ConsentOptions): string
export function renderPrivacyChoices(options?: { label?: string }): string
export function renderPrivacy(policy: PrivacyPolicy): string
export function renderTerms(terms: LegalPage & { copy?: TermsCopy }): string
