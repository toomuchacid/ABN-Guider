export const proposedNameKey = 'startupSavvy.proposedName.v1';

export const abrSearchHome = 'https://abr.business.gov.au/';

export const asicBusinessNamesUrl = 'https://www.asic.gov.au/online-services/search-asic-registers/business-names-register';

export const tradeMarkSearchHome = 'https://search.ipaustralia.gov.au/trademarks/search/quick';

/** Australian Trade Mark Search reads `q` on the quick-results page. */
export function tradeMarkSearchUrl(name) {
  const url = new URL('https://search.ipaustralia.gov.au/trademarks/search/quick/result');
  const query = String(name ?? '').trim().slice(0, 180);
  if (query) url.searchParams.set('q', query);
  return url.toString();
}

export function officialLinkSet(name) {
  const query = String(name ?? '').trim();
  return [
    {
      source: 'ABN Lookup',
      href: abrSearchHome,
      detail: 'Public ABN Lookup. This is a link, not a result for the name.',
    },
    {
      source: 'IP Australia trade marks',
      href: query ? tradeMarkSearchUrl(query) : tradeMarkSearchHome,
      detail: query
        ? 'Australian Trade Mark Search, with the name in the address. Read the results there.'
        : 'Australian Trade Mark Search. Type the name on that page.',
    },
    {
      source: 'ASIC business names',
      href: asicBusinessNamesUrl,
      detail: 'Official business names register. The address cannot pre-fill the name, so type it there.',
    },
  ];
}
