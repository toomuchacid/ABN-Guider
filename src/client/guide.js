import { brand } from '../config/brand.js';
import {
  EMPTY_ANSWERS,
  ENTITIES,
  GST_CHOICES,
  REASONS,
  STATES,
  findTfnField,
  missingCore,
  packFromAnswers,
  sanitiseAnswers,
} from '../lib/guide/pack.js';

const mount = document.querySelector('#guide-app');

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (value === true) node.setAttribute(key, '');
    else if (value !== false && value != null) node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function load() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(brand.storageKey) || 'null');
    return {
      step: Math.min(Math.max(Number(raw?.step) || 0, 0), 5),
      answers: sanitiseAnswers(raw?.answers),
    };
  } catch {
    return { step: 0, answers: { ...EMPTY_ANSWERS } };
  }
}

function persist(state) {
  const answers = sanitiseAnswers(state.answers);
  if (findTfnField(answers)) return false;
  sessionStorage.setItem(brand.storageKey, JSON.stringify({ version: 1, step: state.step, answers }));
  return true;
}

function field(label, control) {
  const wrap = el('div');
  wrap.append(el('label', { for: control.id, text: label }), control);
  return wrap;
}

function textInput(id, value, opts = {}) {
  return el('input', {
    id,
    name: id,
    value,
    maxlength: opts.max || 120,
    autocomplete: opts.autocomplete || 'off',
    type: opts.type || 'text',
  });
}

function choiceGroup(name, options, selected) {
  const group = el('div');
  for (const option of options) {
    const input = el('input', { type: 'radio', name, value: option.value });
    if (option.value === selected) input.checked = true;
    const text = el('span');
    text.append(option.label);
    if (option.hint) text.append(el('span', { class: 'hint', text: option.hint }));
    group.append(el('label', { class: 'choice' }, [input, text]));
  }
  return group;
}

function validate(step, answers) {
  const errors = [];
  if (findTfnField(answers)) errors.push('That looks like a tax file number. Remove it. We never collect a TFN.');
  if (step === 0) {
    if (!answers.reason) errors.push('Choose why you are applying.');
    if (!answers.entityType) errors.push('Choose an entity type.');
  }
  if (step === 1) {
    if (answers.entityType === 'sole-trader') {
      if (!answers.givenName || !answers.familyName) errors.push('Enter your given name and family name.');
    } else if (answers.entityType && answers.entityType !== 'unsure' && !answers.entityName) {
      errors.push('Enter the entity name.');
    }
  }
  if (step === 2) {
    if (answers.activity.trim().length < 8) errors.push('Describe the activity in a short sentence.');
    if (!answers.state) errors.push('Choose where the business mainly operates.');
    if (!answers.startDate) errors.push('Enter a start date.');
  }
  if (step === 3) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email)) errors.push('Enter an email address you can copy onto the official form.');
    if (!answers.suburb) errors.push('Enter a suburb or town.');
    if (answers.state !== 'Outside Australia' && !/^\d{4}$/.test(answers.postcode)) errors.push('Enter a 4-digit postcode.');
  }
  if (step === 4 && !answers.gst) errors.push('Choose the GST answer that matches your current expectation.');
  return errors;
}

function readForm(form, answers) {
  const data = new FormData(form);
  const next = { ...answers };
  for (const [key, value] of data.entries()) {
    if (key in next) next[key] = String(value);
  }
  if (!data.has('reason')) next.reason = answers.reason;
  return sanitiseAnswers(next);
}

const steps = [
  {
    title: 'Who is applying?',
    render: (answers) => [
      el('p', { text: 'This matches the opening questions on the ABN application: why you want an ABN, and what sort of entity is applying.' }),
      el('p', { class: 'fine', text: 'Reason for the application' }),
      choiceGroup('reason', REASONS, answers.reason),
      el('p', { class: 'fine', text: 'Entity type' }),
      choiceGroup('entityType', ENTITIES, answers.entityType),
    ],
  },
  {
    title: 'Names',
    render: (answers) => {
      const sole = answers.entityType === 'sole-trader';
      const nodes = [el('p', { text: 'An ABN does not reserve a trading name. Registering a business name is a separate ASIC process, with its own fee.' })];
      if (sole) {
        nodes.push(field('Given name', textInput('givenName', answers.givenName, { autocomplete: 'given-name' })));
        nodes.push(field('Family name', textInput('familyName', answers.familyName, { autocomplete: 'family-name' })));
      } else {
        nodes.push(field('Entity name', textInput('entityName', answers.entityName, { max: 120 })));
      }
      nodes.push(field('Trading or business name, if you have one', textInput('tradingName', answers.tradingName, { max: 120 })));
      return nodes;
    },
  },
  {
    title: 'What the business does',
    render: (answers) => [
      el('p', { text: 'Describe the main activity in your own words. The official form will also ask you to pick an industry category. We don’t invent that code.' }),
      field('Main activity', el('textarea', { id: 'activity', name: 'activity', maxlength: 500, text: answers.activity })),
      field('Main location', (() => {
        const select = el('select', { id: 'state', name: 'state' });
        select.append(el('option', { value: '', text: 'Choose a state or territory' }));
        for (const state of STATES) {
          const option = el('option', { value: state, text: state });
          if (state === answers.state) option.selected = true;
          select.append(option);
        }
        return select;
      })()),
      field('Date the business starts, or started', textInput('startDate', answers.startDate, { type: 'date' })),
    ],
  },
  {
    title: 'How the form can reach you',
    render: (answers) => [
      el('p', { text: 'These stay in this browser. Leave the street blank if you’d rather type it only on the official site.' }),
      field('Email', textInput('email', answers.email, { type: 'email', autocomplete: 'email' })),
      field('Phone (optional)', textInput('phone', answers.phone, { type: 'tel', autocomplete: 'tel' })),
      field('Street (optional)', textInput('street', answers.street, { autocomplete: 'address-line1', max: 120 })),
      field('Suburb or town', textInput('suburb', answers.suburb, { autocomplete: 'address-level2' })),
      field('Postcode', textInput('postcode', answers.postcode, { autocomplete: 'postal-code', max: 12 })),
      field('Authorised contact, if different from the legal name', textInput('contactName', answers.contactName, { max: 120 })),
    ],
  },
  {
    title: 'GST prompt',
    render: (answers) => [
      el('p', { class: 'callout', text: 'This is not advice. Many small businesses register for GST when turnover is $75,000 or more. That figure is general public information and can change. Confirm it on the ATO website, and choose the answer you expect to give the official form.' }),
      choiceGroup('gst', GST_CHOICES, answers.gst),
    ],
  },
];

function render() {
  const state = load();
  mount.replaceChildren();
  const form = el('form', { class: 'panel stack' });
  form.append(
    el('p', { class: 'todo', text: 'TODO: confirm this wording against the live ABR screens before calling the pack a complete field match.' }),
    el('p', { class: 'progress', text: `Step ${state.step + 1} of 6` }),
    el('h2', { text: state.step === 5 ? 'Review' : steps[state.step].title }),
  );
  const errorBox = el('div', { class: 'form-error', role: 'alert', tabindex: '-1', hidden: true });
  form.append(errorBox);

  if (state.step < 5) {
    for (const node of steps[state.step].render(state.answers)) form.append(node);
  } else {
    const missing = missingCore(state.answers);
    if (missing.length) form.append(el('p', { class: 'callout', text: `Still worth adding: ${missing.join(', ')}.` }));
    const list = el('div', { class: 'stack' });
    for (const row of packFromAnswers(state.answers)) {
      const block = el('div');
      block.append(el('h3', { text: row.label }), el('p', { text: row.value }));
      list.append(block);
    }
    form.append(
      el('p', { text: 'This review stays on your device. The paid pack adds copy buttons and the handoff to the free official application.' }),
      list,
      el('a', { class: 'btn btn-primary', href: '/unlock', text: `Unlock the copy-ready pack` }),
    );
  }

  const actions = el('div', { class: 'cta-row' });
  if (state.step > 0) {
    actions.append(el('button', { class: 'btn btn-secondary', type: 'button', text: 'Back' }));
  }
  if (state.step < 5) actions.append(el('button', { class: 'btn btn-primary', type: 'submit', text: state.step === 4 ? 'Review answers' : 'Continue' }));
  form.append(actions);
  mount.append(form);

  form.querySelector('.btn-secondary')?.addEventListener('click', () => {
    const answers = state.step < 5 ? readForm(form, state.answers) : state.answers;
    if (!persist({ step: state.step - 1, answers })) {
      errorBox.hidden = false;
      errorBox.textContent = 'Remove the tax file number before going back.';
      return;
    }
    render();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.step >= 5) return;
    const answers = readForm(form, state.answers);
    const errors = validate(state.step, answers);
    if (errors.length) {
      errorBox.hidden = false;
      errorBox.textContent = errors[0];
      errorBox.focus();
      return;
    }
    if (!persist({ step: state.step + 1, answers })) {
      errorBox.hidden = false;
      errorBox.textContent = 'Remove the tax file number. We never store one.';
      return;
    }
    render();
  });
}

if (mount) render();
