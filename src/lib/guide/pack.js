import { containsTfnPhrase } from '../privacy/tfn.js';

export const REASONS = [
  { value: 'starting', label: 'I am starting a new business' },
  { value: 'already', label: 'I have already started the business' },
];

export const ENTITIES = [
  { value: 'sole-trader', label: 'Sole trader', hint: 'You will apply as an individual.' },
  { value: 'company', label: 'Company', hint: 'Have the ACN ready on the official form. We don’t collect it here.' },
  { value: 'partnership', label: 'Partnership', hint: 'The official form will ask for the partners.' },
  { value: 'trust', label: 'Trust', hint: 'The official form will ask about the trustee.' },
  { value: 'super-fund', label: 'Superannuation fund', hint: 'Most new small businesses are not a super fund.' },
  { value: 'unsure', label: 'Not sure yet', hint: 'You can still draft the pack and decide on the official form.' },
];

export const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT', 'Outside Australia'];

export const GST_CHOICES = [
  { value: 'yes', label: 'I expect to register for GST' },
  { value: 'no', label: 'I don’t expect to register for GST' },
  { value: 'unsure', label: 'I’m not sure' },
];

export const EMPTY_ANSWERS = {
  reason: '',
  entityType: '',
  givenName: '',
  familyName: '',
  entityName: '',
  tradingName: '',
  activity: '',
  state: '',
  startDate: '',
  email: '',
  phone: '',
  street: '',
  suburb: '',
  postcode: '',
  contactName: '',
  gst: '',
};

const LIMITS = {
  givenName: 60,
  familyName: 60,
  entityName: 120,
  tradingName: 120,
  activity: 500,
  email: 120,
  phone: 30,
  street: 120,
  suburb: 60,
  postcode: 12,
  contactName: 120,
  startDate: 20,
};

function clean(value, max) {
  return String(value ?? '').replace(/[\u0000-\u001F]/g, '').trim().slice(0, max);
}

export function sanitiseAnswers(input) {
  const source = input && typeof input === 'object' ? input : {};
  const answers = { ...EMPTY_ANSWERS };
  for (const key of Object.keys(EMPTY_ANSWERS)) {
    answers[key] = clean(source[key], LIMITS[key] || 80);
  }
  if (!REASONS.some((item) => item.value === answers.reason)) answers.reason = '';
  if (!ENTITIES.some((item) => item.value === answers.entityType)) answers.entityType = '';
  if (!STATES.includes(answers.state)) answers.state = '';
  if (!GST_CHOICES.some((item) => item.value === answers.gst)) answers.gst = '';
  if (answers.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(answers.startDate)) answers.startDate = '';
  if (answers.postcode && answers.state !== 'Outside Australia' && !/^\d{4}$/.test(answers.postcode)) {
    answers.postcode = answers.postcode.replace(/\D/g, '').slice(0, 4);
  }
  return answers;
}

const STRUCTURED_FIELDS = new Set(['startDate', 'postcode', 'email', 'phone']);

export function findTfnField(answers) {
  for (const [key, value] of Object.entries(answers)) {
    const text = String(value ?? '');
    if (STRUCTURED_FIELDS.has(key)) {
      if (/\b(tfn|tax\s*file\s*number)\b/i.test(text)) return key;
      continue;
    }
    if (containsTfnPhrase(text)) return key;
  }
  return null;
}

function labelOf(list, value) {
  return list.find((item) => item.value === value)?.label || '';
}

function blank(value, fallback = 'Not entered yet') {
  const text = String(value || '').trim();
  return text || fallback;
}

export function legalName(answers) {
  if (answers.entityType === 'sole-trader') {
    return blank([answers.givenName, answers.familyName].filter(Boolean).join(' '));
  }
  return blank(answers.entityName);
}

export function contactLine(answers) {
  if (answers.contactName) return answers.contactName;
  if (answers.entityType === 'sole-trader') return legalName(answers);
  return 'Not entered yet';
}

export function addressLine(answers) {
  const parts = [answers.street, answers.suburb, answers.state, answers.postcode].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Not entered yet';
}

/**
 * Ready-to-copy rows aligned with the topics on the public ABN application.
 * This is a practical checklist, not a pixel copy of a government screen.
 */
export function packFromAnswers(raw) {
  const answers = sanitiseAnswers(raw);
  const gst = labelOf(GST_CHOICES, answers.gst);
  return [
    { id: 'reason', label: 'Reason for applying', value: blank(labelOf(REASONS, answers.reason)) },
    { id: 'entityType', label: 'Entity type', value: blank(labelOf(ENTITIES, answers.entityType)) },
    { id: 'legalName', label: 'Legal name on the application', value: legalName(answers) },
    { id: 'tradingName', label: 'Trading or business name', value: blank(answers.tradingName, 'No separate trading name entered') },
    { id: 'activity', label: 'Main business activity, in plain English', value: blank(answers.activity) },
    { id: 'startDate', label: 'Expected or actual start date', value: blank(answers.startDate) },
    { id: 'location', label: 'Where the business is mainly carried on', value: addressLine(answers) },
    { id: 'email', label: 'Business email', value: blank(answers.email) },
    { id: 'phone', label: 'Business phone', value: blank(answers.phone, 'Not entered') },
    { id: 'contact', label: 'Authorised contact', value: contactLine(answers) },
    { id: 'gst', label: 'GST registration intention', value: blank(gst) },
  ];
}

export function packAsText(rows) {
  return rows.map((row) => `${row.label}: ${row.value}`).join('\n');
}

export function missingCore(answers) {
  const cleanAnswers = sanitiseAnswers(answers);
  const missing = [];
  if (!cleanAnswers.reason) missing.push('why you are applying');
  if (!cleanAnswers.entityType) missing.push('entity type');
  if (cleanAnswers.entityType === 'sole-trader') {
    if (!cleanAnswers.givenName || !cleanAnswers.familyName) missing.push('your given and family name');
  } else if (cleanAnswers.entityType && !cleanAnswers.entityName) {
    missing.push('the entity name');
  }
  if (!cleanAnswers.activity) missing.push('what the business does');
  if (!cleanAnswers.state) missing.push('the state or territory');
  if (!cleanAnswers.email) missing.push('an email address');
  return missing;
}
