/**
 * Product name, price, and other brand facts live here.
 * Rename the product by editing `name` (and `integrationSlug` if the
 * Stripe integration label should change too).
 */
export const brand = {
  name: 'Startup Savvy',
  legalName: '[Legal entity name to be confirmed]',
  tagline: 'Check the name. Prepare the ABN application. Hand it to the free official form.',
  priceAudCents: 1900,
  currency: 'aud',
  contactEmail: 'hello@example.com',
  integrationSlug: 'startup-savvy',
  officialAbnUrl: 'https://register.business.gov.au/',
  abrUrl: 'https://www.abr.gov.au/',
  asicUrl: 'https://asic.gov.au/for-business/registering-a-business-name/',
  ipAustraliaUrl: 'https://www.ipaustralia.gov.au/',
  atoGstUrl: 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst',
  storageKey: 'startupSavvy.guide.v1',
  cookieName: 'ss_entitlement',
  cookieMaxAgeSeconds: 60 * 60 * 24 * 400,
  analytics: {
    /** 'none' | 'plausible' | 'cloudflare' */
    provider: 'none',
    plausibleDomain: '',
    cloudflareToken: '',
  },
};

export function formatAud(cents = brand.priceAudCents) {
  const dollars = cents / 100;
  const amount = Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
  return `A$${amount}`;
}
