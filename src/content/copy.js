import { brand, formatAud } from '../config/brand.js';

export const nav = [
  { href: '/name-check', label: 'Name check' },
  { href: '/guide', label: 'ABN guide' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/feedback', label: 'Feedback' },
];

export const legalNav = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/disclaimer', label: 'Disclaimer' },
  { href: '/refunds', label: 'Refunds' },
];

export const officialLinks = [
  { href: brand.officialAbnUrl, label: 'Apply for an ABN (official)' },
  { href: brand.abrUrl, label: 'Australian Business Register' },
  { href: brand.asicUrl, label: 'ASIC business names' },
  { href: brand.ipAustraliaUrl, label: 'IP Australia' },
];

export const paymentDisclosure = [
  `${brand.name} is a private guide. It is not part of, or affiliated with, the Australian Taxation Office, the Australian Business Register, ASIC or IP Australia.`,
  'Applying for an ABN is free on the official government website. The price on this page is for this private guide only. It is not a government fee.',
  'The pack is general information to help you prepare. It is not tax, legal or financial advice, and it does not lodge the application for you.',
  'A business name, company, domain and trade mark are separate from an ABN. They can have their own fees and their own official processes.',
];

export const home = {
  eyebrow: 'A private guide for people starting a business in Australia',
  title: 'Check the name. Prepare the ABN. Then use the free official form.',
  lede: `${brand.name} helps you see how a proposed business name reads, then walks you through the details the free ABN application asks for. You copy the summary and finish on the government site. We never lodge it for you.`,
  priceNote: `The official ABN application is free. This guide is ${formatAud()} once, when you want the copy-ready pack.`,
  honesty: 'The public name check does not run the live registers, and it does not show a green light. The traffic lights are in the paid application pack. A failed or unfinished check is never shown as available.',
  steps: [
    {
      title: 'Read a name in plain English',
      body: 'Green, amber and red for domains, trade marks and business names. A failed check stays grey. It is never shown as a clear result.',
    },
    {
      title: 'Unlock the sole-trader pack',
      body: `The questions are in the paid pack (${formatAud()} once). They cover who you are, the activity, the start date, the address type, GST and a business-name intention. We never ask for a tax file number.`,
    },
    {
      title: 'Copy it onto the free form',
      body: 'You transcribe the summary into the official application yourself. We do not fill, submit or call the government form. Card payments are handled by Stripe. We don’t see your card number.',
    },
  ],
  separate: [
    { name: 'ABN', detail: 'Free to apply on the Australian Business Register. This identifies the business for tax. We don’t apply for you.' },
    { name: 'Business name', detail: 'An ASIC registration with its own government fee. Different from an ABN, a company name and a domain.' },
    { name: 'Company', detail: 'A separate ASIC process if you are incorporating. Not required just to hold an ABN.' },
    { name: 'Domain and trade mark', detail: 'A domain is rented from a registrar. A trade mark is an IP Australia right. Neither comes with an ABN.' },
  ],
  included: [
    'A guided questionnaire mapped to the public ABN application topics',
    'A copy-ready summary that stays in your browser',
    'Plain-English name-check rows in the paid pack. A failed check is never shown as available',
    'A direct handoff to the free official application',
    'One payment. No subscription and no account',
  ],
  excluded: [
    'Lodging or tracking an ABN application',
    'Registering a business name, company, domain or trade mark',
    'Tax, legal or financial advice',
    'A guarantee that any name can be registered or protected',
  ],
};

export const faq = [
  {
    q: 'Is this a government website?',
    a: `No. ${brand.name} is a private guide. We are not the ATO, the ABR, ASIC or IP Australia, and we are not speaking for them. The banner on every page says so.`,
  },
  {
    q: 'Is an ABN free?',
    a: 'Yes. Applying for an ABN on the official government service is free. You do not need to pay a third party to lodge it. Our fee, if you choose to pay it, is only for this preparation guide.',
  },
  {
    q: `What does the ${formatAud()} pay for?`,
    a: 'A one-time unlock of the copy-ready application pack on this site: the formatted answers from the guide, copy buttons, and the link to the official form. It does not buy the ABN itself.',
  },
  {
    q: 'Will you ask for my tax file number?',
    a: 'No. We never ask for a tax file number and we don’t want one typed into any box on this site. If the official application asks for it, enter it only there.',
  },
  {
    q: 'Do you register the business name as well?',
    a: 'No. A business name is an ASIC process with its own fee. A domain is bought from a registrar. A trade mark is an IP Australia application. This guide only helps you prepare the free ABN application and understand those differences.',
  },
  {
    q: 'Are the name-check results live?',
    a: 'The public page does not run them. The paid pack checks DNS for .com.au, .au and .net.au, and links to the official trade mark and business-name searches. ABN Lookup runs only when it is configured. A failed or unfinished check is never shown as available, and none of the lights is a clearance.',
  },
  {
    q: 'Where do my questionnaire answers go?',
    a: 'They stay in this browser’s local storage on this device. They are not sent to our server and they are not logged. Delete my answers, on the paid pack, removes them. The pack can only refill them on the same device.',
  },
  {
    q: 'Can I get a refund?',
    a: 'See the draft refund policy. Australian Consumer Law guarantees still apply. The policy on this site is a draft and needs a lawyer’s review before launch.',
  },
  {
    q: 'Is this tax or legal advice?',
    a: 'No. It is general information to help you get organised. Whether you should register for GST, which entity type fits, and whether a name is safe to use are decisions for you — and, if you need it, a registered tax agent, accountant or lawyer.',
  },
];
