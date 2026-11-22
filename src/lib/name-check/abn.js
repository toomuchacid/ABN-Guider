import { abrSearchHome } from './official-links.js';
import { CheckTimeout, comparableName, fetchWithTimeout, redactSecrets, secretMissing, withCache } from './support.js';

export const ABN_SEARCH_URL = 'https://abr.business.gov.au/ABRXMLSearch/AbrXmlSearch.asmx/ABRSearchByNameAdvancedSimpleProtocol2017';

function tagValues(xml, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  return [...xml.matchAll(re)].map((match) => match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** Names inside result records only. The request echo of the searched name is ignored. */
export function exactNamesFromAbrXml(xml) {
  const records = [...String(xml || '').matchAll(/<searchResultsRecord\b[^>]*>([\s\S]*?)<\/searchResultsRecord>/gi)];
  const names = [];
  for (const record of records) {
    const block = record[1];
    for (const tag of ['organisationName', 'fullName', 'mainName']) {
      names.push(...tagValues(block, tag));
    }
    const given = tagValues(block, 'givenName');
    const family = tagValues(block, 'familyName');
    if (family[0]) names.push(`${given.join(' ')} ${family[0]}`.trim());
  }
  return names;
}

function result(partial, checkedAt) {
  return { source: 'abn', checkedAt, ...partial };
}

export async function checkAbn(name, deps) {
  const checkedAt = (deps.now ? deps.now() : new Date()).toISOString();
  const guid = typeof deps.guid === 'string' ? deps.guid.trim() : '';
  if (secretMissing(guid)) {
    return result({
      status: 'risk',
      label: 'Not available yet',
      detail: 'Live ABN search is not yet available. Search the public register yourself. This is not a clearance.',
      href: abrSearchHome,
    }, checkedAt);
  }

  return withCache(deps.cache, 'abn', name, async () => {
    const body = new URLSearchParams({
      name,
      postcode: '',
      legalName: 'Y',
      tradingName: 'Y',
      businessName: 'Y',
      activeABNsOnly: 'Y',
      NSW: '',
      SA: '',
      ACT: '',
      VIC: '',
      WA: '',
      NT: '',
      QLD: '',
      TAS: '',
      authenticationGuid: guid,
      searchWidth: 'narrow',
      minimumScore: '80',
      maxSearchResults: '20',
    });
    let response;
    try {
      await deps.sleep?.(deps.gapMs || 0);
      response = await fetchWithTimeout(deps.fetchImpl, ABN_SEARCH_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/xml, text/xml',
        },
        body,
      }, deps.timeoutMs);
    } catch (error) {
      const timedOut = error instanceof CheckTimeout || error?.name === 'CheckTimeout';
      return result({
        status: 'error',
        label: 'Check failed',
        detail: timedOut
          ? 'ABN Lookup did not answer in time. This is not a clearance.'
          : 'ABN Lookup could not be completed. This is not a clearance.',
        href: abrSearchHome,
      }, checkedAt);
    }

    let xml = '';
    try {
      xml = await response.text();
    } catch {
      xml = '';
    }
    if (!response.ok || xml.length > 400_000) {
      return result({
        status: 'error',
        label: 'Check failed',
        detail: 'ABN Lookup could not be completed. This is not a clearance.',
        href: abrSearchHome,
      }, checkedAt);
    }

    const exception = tagValues(xml, 'exceptionDescription')[0];
    if (exception || /<exception\b/i.test(xml)) {
      const detail = redactSecrets(
        exception || 'ABN Lookup did not accept the search.',
        [guid],
      );
      return result({
        status: 'error',
        label: 'Check failed',
        detail: `${detail} This is not a clearance.`.replace(/\s+/g, ' ').trim(),
        href: abrSearchHome,
      }, checkedAt);
    }

    const wanted = comparableName(name);
    const found = exactNamesFromAbrXml(xml);
    const exact = found.filter((item) => comparableName(item) === wanted);
    if (exact.length > 0) {
      const count = exact.length === 1 ? '1 exact name match' : `${exact.length} exact name matches`;
      return result({
        status: 'taken',
        label: 'Exact match',
        detail: `ABN Lookup returned ${count} on an active ABN. That is not a decision about whether you can use the name.`,
        href: abrSearchHome,
      }, checkedAt);
    }
    if (found.length > 0) {
      return result({
        status: 'risk',
        label: 'No exact match',
        detail: 'ABN Lookup returned names, and none was an exact match. This is not a clearance.',
        href: abrSearchHome,
      }, checkedAt);
    }
    return result({
      status: 'risk',
      label: 'No exact match',
      detail: 'No exact name match in this ABN Lookup search. This is not a clearance.',
      href: abrSearchHome,
    }, checkedAt);
  });
}
