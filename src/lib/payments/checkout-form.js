import { brand } from '../../config/brand.js';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function randomLetters(length = 8, random = crypto.getRandomValues.bind(crypto)) {
  const bytes = new Uint8Array(length);
  random(bytes);
  return [...bytes].map((byte) => LETTERS[byte % 26]).join('');
}

export function makeIntegrationId(suffix = randomLetters()) {
  if (!/^[a-z]{8}$/.test(suffix)) throw new Error('Integration id suffix must be 8 letters.');
  return `${brand.integrationSlug}-unlock-${suffix}`;
}

export const checkoutProduct = {
  name: `${brand.name} — ABN application pack`,
  description:
    'Private preparation guide. Not an ABN fee. ABN registration is free on the official government site. Not affiliated with the ATO, ABR, ASIC or IP Australia. General information, not tax or legal advice.',
};

/**
 * Fields for Stripe Checkout Sessions create. Price always comes from
 * server config. `payment_method_types` is intentionally omitted so Stripe
 * can choose eligible methods. `automatic_tax` stays off until the
 * operator has an active GST registration and chooses to enable Stripe Tax.
 */
export function buildCheckoutFields({ origin, entitlementId, integrationId }) {
  return [
    ['mode', 'payment'],
    ['success_url', `${origin}/unlock/return?session_id={CHECKOUT_SESSION_ID}`],
    ['cancel_url', `${origin}/unlock?cancelled=1`],
    ['client_reference_id', entitlementId],
    ['metadata[entitlementId]', entitlementId],
    ['line_items[0][quantity]', '1'],
    ['line_items[0][price_data][currency]', brand.currency],
    ['line_items[0][price_data][unit_amount]', String(brand.priceAudCents)],
    ['line_items[0][price_data][product_data][name]', checkoutProduct.name],
    ['line_items[0][price_data][product_data][description]', checkoutProduct.description],
    ['integration_identifier', integrationId],
  ];
}

export function encodeForm(fields) {
  return fields.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
}

export function checkoutFieldsInclude(fields, key) {
  return fields.some(([name]) => name === key || name.startsWith(`${key}[`));
}
