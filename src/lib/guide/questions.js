import {
  ADDRESS_TYPES,
  ASSOCIATES,
  ENTITIES,
  GST_CHOICES,
  NAME_INTENTS,
  STATES,
  TURNOVER,
  findTfnField,
  sanitiseAnswers,
} from './pack.js';

/** Published ATO GST turnover threshold for most businesses, in dollars. Confirm on the ATO page. */
export const GST_TURNOVER_THRESHOLD_AUD = 75000;

export const STEP_COUNT = 6;

const OFFICIAL_HOSTS = new Set([
  'www.abr.gov.au',
  'abr.gov.au',
  'abr.business.gov.au',
  'register.business.gov.au',
  'www.business.gov.au',
  'business.gov.au',
  'www.ato.gov.au',
  'ato.gov.au',
  'www.asic.gov.au',
  'asic.gov.au',
  'www.abs.gov.au',
  'abs.gov.au',
]);

export const SOURCES = {
  abnGuide: {
    label: 'business.gov.au: register for an ABN',
    href: 'https://business.gov.au/registrations/register-for-an-australian-business-number-abn',
  },
  apply: {
    label: 'Official ABN application',
    href: 'https://register.business.gov.au/',
  },
  abr: {
    label: 'Australian Business Register',
    href: 'https://www.abr.gov.au/',
  },
  abrLookup: {
    label: 'ABN Lookup',
    href: 'https://abr.business.gov.au/',
  },
  soleTraderBusiness: {
    label: 'business.gov.au: sole trader',
    href: 'https://business.gov.au/planning/business-structures-and-types/business-structures/sole-trader',
  },
  soleTraderAto: {
    label: 'ATO: sole trader',
    href: 'https://www.ato.gov.au/businesses-and-organisations/starting-registering-or-closing-a-business/business-structures/sole-trader',
  },
  gstAto: {
    label: 'ATO: registering for GST',
    href: 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/registering-for-gst',
  },
  gstBusiness: {
    label: 'business.gov.au: register for GST',
    href: 'https://business.gov.au/registrations/register-for-taxes/register-for-goods-and-services-tax-gst',
  },
  businessNameAsic: {
    label: 'ASIC: register a business name',
    href: 'https://www.asic.gov.au/for-business/registering-a-business-name/',
  },
  businessNameGov: {
    label: 'business.gov.au: register a business name',
    href: 'https://business.gov.au/registrations/register-a-business-name',
  },
  anzsic: {
    label: 'ABS: ANZSIC industry classification',
    href: 'https://www.abs.gov.au/statistics/classifications/australian-and-new-zealand-standard-industrial-classification-anzsic/latest-release',
  },
};

export function safeOfficialHref(value) {
  if (typeof value !== 'string' || value.length > 300) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !OFFICIAL_HOSTS.has(url.hostname)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isPastDate(value, now = new Date()) {
  if (!isIsoDate(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return date < today;
}

/**
 * Non-sole-traders and anyone with an associate stop here.
 * The guide does not collect their application.
 */
export function soleTraderRoute(raw) {
  const answers = sanitiseAnswers(raw);
  if (!answers.entityType || !answers.associates) return { proceed: false, reason: 'missing' };
  if (answers.entityType !== 'sole-trader') return { proceed: false, reason: 'not-sole-trader' };
  if (answers.associates === 'yes') return { proceed: false, reason: 'associates' };
  return { proceed: true, reason: 'sole-trader' };
}

export function routeMessage(reason) {
  if (reason === 'not-sole-trader' || reason === 'associates') {
    return 'This guide is for sole traders. A company, partnership, trust, super fund, or a business with someone else involved, uses a different official application. Continue on the free government site. If you are applying on your own, change the answers above.';
  }
  return '';
}

export function gstGuidance(raw) {
  const answers = sanitiseAnswers(raw);
  const base = `The ATO publishes a GST turnover threshold of A$${GST_TURNOVER_THRESHOLD_AUD.toLocaleString('en-AU')} for most businesses. This is general public information, not tax advice, and the figure can change. Confirm it on the ATO page before you decide. This guide does not register you for GST.`;
  let specific = '';
  if (answers.turnover === 'under') {
    specific = 'You said you expect turnover under that published threshold. Many businesses in that position can choose whether to register. The official form still asks you to decide.';
  } else if (answers.turnover === 'over') {
    specific = 'You said you expect turnover at or over that published threshold. The ATO says businesses at or over the threshold generally need to register. Confirm that on the ATO page.';
  } else if (answers.turnover === 'unsure') {
    specific = 'You are not sure about turnover. The ATO page explains how the threshold is worked out, and the official form lets you answer when you are ready.';
  }
  let choice = '';
  if (answers.gst === 'yes') choice = 'You expect to tell the official form that you want to register for GST.';
  if (answers.gst === 'no') choice = 'You expect to tell the official form that you do not want to register for GST yet.';
  if (answers.gst === 'unsure') choice = 'You have not decided about GST registration.';
  return {
    thresholdAud: GST_TURNOVER_THRESHOLD_AUD,
    href: SOURCES.gstAto.href,
    text: [base, specific, choice].filter(Boolean).join(' '),
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStep(step, raw, now = new Date()) {
  const answers = sanitiseAnswers(raw);
  const errors = [];
  if (findTfnField(answers)) errors.push('That looks like a tax file number. Remove it. We never collect a TFN.');
  const route = soleTraderRoute(answers);
  if (step === 0) {
    if (route.reason === 'missing') errors.push('Choose the structure, and say whether anyone else is part of the business.');
    return { errors, route };
  }
  if (!route.proceed) return { errors, route };
  if (step === 1) {
    if (!answers.givenName || !answers.familyName) errors.push('Enter your given name and family name.');
    if (!isPastDate(answers.dateOfBirth, now)) errors.push('Enter your date of birth. It needs to be a real date in the past.');
  }
  if (step === 2) {
    if (answers.activity.trim().length < 12) errors.push('Describe the main activity in a short sentence. We do not invent an industry code.');
  }
  if (step === 3) {
    if (!isIsoDate(answers.startDate)) errors.push('Enter the date the business starts, or started.');
    if (!answers.addressType) errors.push('Choose the address type that matches where you work.');
    if (!answers.state) errors.push('Choose where the business mainly operates.');
    if (!answers.suburb) errors.push('Enter a suburb or town.');
    const australia = answers.state !== 'Outside Australia' && answers.addressType !== 'outside';
    if (australia && !/^\d{4}$/.test(answers.postcode)) errors.push('Enter a 4-digit postcode, or leave the street for the official form.');
    if (!EMAIL.test(answers.email)) errors.push('Enter an email address you can copy onto the official form.');
  }
  if (step === 4) {
    if (!answers.nameIntent) errors.push('Choose what you plan to do about a business name.');
    if ((answers.nameIntent === 'register' || answers.nameIntent === 'already') && !answers.tradingName) {
      errors.push('Enter the business name you will copy onto the form.');
    }
  }
  if (step === 5) {
    if (!answers.gst) errors.push('Choose the GST answer you expect to give the official form.');
    if (!answers.turnover) errors.push('Choose the turnover answer that matches your current expectation.');
  }
  return { errors, route };
}

export const STEPS = [
  {
    title: 'Are you a sole trader?',
    sources: [SOURCES.soleTraderBusiness, SOURCES.soleTraderAto, SOURCES.abnGuide],
    intro: 'The official application asks what sort of entity is applying, and whether other people or entities are involved. This pack only continues for a sole trader applying on their own.',
  },
  {
    title: 'Your name',
    sources: [SOURCES.abnGuide, SOURCES.apply],
    intro: 'A sole trader application asks for the person’s name and date of birth. Type a tax file number only on the official form. This page never asks for one.',
  },
  {
    title: 'What the business does',
    sources: [SOURCES.abnGuide, SOURCES.anzsic],
    intro: 'The official form asks you to describe the main activity and then pick an industry category. Write that description in your own words. This guide does not assign an ANZSIC code.',
  },
  {
    title: 'When and where',
    sources: [SOURCES.abnGuide, SOURCES.apply],
    intro: 'The official application asks when the business starts and for an address. Choose the address type first. Leave the street blank if you would rather type it only on the official site.',
  },
  {
    title: 'Business name',
    sources: [SOURCES.businessNameAsic, SOURCES.businessNameGov, SOURCES.abnGuide],
    intro: 'An ABN does not reserve a business name. Registering a business name is a separate ASIC process, with its own fee. Trading under your own name is different again.',
  },
  {
    title: 'GST',
    sources: [SOURCES.gstAto, SOURCES.gstBusiness],
    intro: '',
  },
];

export const CHECKLIST = [
  { id: 'copy-yourself', label: 'Copy each line into the official application yourself. This site does not fill, submit or call the government form.' },
  { id: 'tfn', label: 'If the official form asks for a tax file number, type it only there.' },
  { id: 'name-check', label: 'Read the name-check lights. Amber and grey are not a clearance to use the name.' },
  { id: 'gst', label: 'Confirm the GST threshold on the ATO page before you answer that question on the official form.' },
  { id: 'business-name', label: 'Treat a business name, a company, a domain and a trade mark as separate from the ABN.' },
  { id: 'free', label: 'Remember that ABN registration is free on the government site. This pack is not a government fee.' },
];

export function sanitiseChecks(input) {
  const source = input && typeof input === 'object' ? input : {};
  const checks = {};
  for (const item of CHECKLIST) checks[item.id] = source[item.id] === true;
  return checks;
}

export function whatHappensNext() {
  return [
    {
      title: 'Open the free official application',
      body: 'ABN registration is free. Use the government site. This pack does not lodge it.',
      href: SOURCES.apply.href,
    },
    {
      title: 'Transcribe the summary yourself',
      body: 'Copy or type each line into the form. Nothing here fills a government page for you.',
      href: SOURCES.abnGuide.href,
    },
    {
      title: 'Decide the separate registrations',
      body: 'A business name is ASIC. A trade mark is IP Australia. A domain is a registrar. None of them comes with the ABN.',
      href: SOURCES.businessNameGov.href,
    },
    {
      title: 'Delete the answers when you are finished',
      body: 'They are stored only in this browser. Delete my answers removes them from this device.',
      href: '',
    },
  ];
}

export const QUESTION_FIELDS = {
  entities: ENTITIES,
  associates: ASSOCIATES,
  addressTypes: ADDRESS_TYPES,
  nameIntents: NAME_INTENTS,
  states: STATES,
  gst: GST_CHOICES,
  turnover: TURNOVER,
};
