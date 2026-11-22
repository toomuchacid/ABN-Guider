/** Matches the ApiVersion pinned by the installed `stripe` npm package. */
export const STRIPE_API_VERSION = '2026-11-18.endive';

export function stripeHeaders(secretKey) {
  return {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': STRIPE_API_VERSION,
  };
}
