import { brand } from '../config/brand.js';
import { deliverPackByEmail } from '../lib/guide/email-stub.js';
import {
  QUESTION_FIELDS,
  STEPS,
  STEP_COUNT,
  gstGuidance,
  routeMessage,
  safeOfficialHref,
  validateStep,
} from '../lib/guide/questions.js';
import { clearGuideState, readGuideState, writeGuideState } from '../lib/guide/storage.js';

function browserStores() {
  return { local: localStorage, session: sessionStorage };
}

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

function field(label, control) {
  const wrap = el('div');
  wrap.append(el('label', { for: control.id, text: label }), control);
  return wrap;
}

function textInput(id, value, opts = {}) {
  return el('input', {
    id,
    name: id,
    value: value || '',
    maxlength: opts.max || 120,
    autocomplete: opts.autocomplete || 'off',
    type: opts.type || 'text',
    required: opts.required || false,
  });
}

function choiceGroup(legend, name, options, selected) {
  const group = el('fieldset');
  group.append(el('legend', { text: legend }));
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

function sourceList(sources) {
  const list = el('ul', { class: 'source-list' });
  for (const source of sources) {
    const href = safeOfficialHref(source.href);
    if (!href) continue;
    const link = el('a', { href, target: '_blank', rel: 'noopener noreferrer', text: source.label });
    link.append(el('span', { class: 'sr-only', text: ' (opens in a new tab)' }));
    list.append(el('li', {}, [link]));
  }
  return list;
}

function readForm(form, answers) {
  const data = new FormData(form);
  const next = { ...answers };
  for (const [key, value] of data.entries()) {
    if (key in next) next[key] = String(value);
  }
  return next;
}

function renderStep(answers, step) {
  if (step === 0) {
    return [
      choiceGroup('Structure', 'entityType', QUESTION_FIELDS.entities, answers.entityType),
      choiceGroup('Is anyone else part of the business?', 'associates', QUESTION_FIELDS.associates, answers.associates),
    ];
  }
  if (step === 1) {
    return [
      field('Given name', textInput('givenName', answers.givenName, { autocomplete: 'given-name', required: true })),
      field('Family name', textInput('familyName', answers.familyName, { autocomplete: 'family-name', required: true })),
      field('Date of birth', textInput('dateOfBirth', answers.dateOfBirth, { type: 'date', autocomplete: 'bday', required: true })),
    ];
  }
  if (step === 2) {
    return [
      field('Main activity, in your own words', el('textarea', {
        id: 'activity',
        name: 'activity',
        maxlength: 500,
        required: true,
        text: answers.activity,
      })),
    ];
  }
  if (step === 3) {
    const select = el('select', { id: 'state', name: 'state', required: true });
    select.append(el('option', { value: '', text: 'Choose a state or territory' }));
    for (const state of QUESTION_FIELDS.states) {
      const option = el('option', { value: state, text: state });
      if (state === answers.state) option.selected = true;
      select.append(option);
    }
    return [
      field('Date the business starts, or started', textInput('startDate', answers.startDate, { type: 'date', required: true })),
      choiceGroup('Address type', 'addressType', QUESTION_FIELDS.addressTypes, answers.addressType),
      field('State or territory', select),
      field('Suburb or town', textInput('suburb', answers.suburb, { autocomplete: 'address-level2', required: true })),
      field('Postcode', textInput('postcode', answers.postcode, { autocomplete: 'postal-code', max: 12 })),
      field('Street (optional)', textInput('street', answers.street, { autocomplete: 'address-line1', max: 120 })),
      field('Email', textInput('email', answers.email, { type: 'email', autocomplete: 'email', required: true })),
      field('Phone (optional)', textInput('phone', answers.phone, { type: 'tel', autocomplete: 'tel' })),
    ];
  }
  if (step === 4) {
    return [
      choiceGroup('What do you plan to do about a business name?', 'nameIntent', QUESTION_FIELDS.nameIntents, answers.nameIntent),
      field('Business or trading name, if you have one', textInput('tradingName', answers.tradingName, { max: 120 })),
    ];
  }
  return [
    el('p', { class: 'callout', text: gstGuidance(answers).text }),
    choiceGroup('What do you expect to tell the official form about GST?', 'gst', QUESTION_FIELDS.gst, answers.gst),
    choiceGroup('Turnover, compared with the published A$75,000 threshold', 'turnover', QUESTION_FIELDS.turnover, answers.turnover),
  ];
}

export function mountQuestionnaire(mount, stores = browserStores()) {
  function render() {
    const state = readGuideState(stores);
    mount.replaceChildren();
    const form = el('form', { class: 'panel stack', id: 'questionnaire', novalidate: true });
    const step = STEPS[state.step];
    form.append(
      el('p', { class: 'progress', text: `Step ${state.step + 1} of ${STEP_COUNT}` }),
      el('h2', { id: 'question-title', text: step.title }),
      step.intro ? el('p', { text: step.intro }) : null,
      sourceList(step.sources),
    );
    const errorBox = el('div', { id: 'question-error', class: 'form-error', role: 'alert', tabindex: '-1', hidden: true });
    form.append(errorBox);
    for (const node of renderStep(state.answers, state.step)) form.append(node);

    const actions = el('div', { class: 'cta-row' });
    if (state.step > 0) actions.append(el('button', { class: 'btn btn-secondary', type: 'button', id: 'question-back', text: 'Back' }));
    actions.append(el('button', {
      class: 'btn btn-primary',
      type: 'submit',
      text: state.step === STEP_COUNT - 1 ? 'Save and show my pack' : 'Continue',
    }));
    form.append(actions, deleteControls());
    mount.append(form);
    wire(form, state);
  }

  function deleteControls() {
    const wrap = el('div', { class: 'stack' });
    wrap.append(
      el('button', { class: 'btn btn-secondary', type: 'button', id: 'delete-answers', text: 'Delete my answers' }),
      el('p', { id: 'delete-note', class: 'fine', hidden: true, text: 'This removes the answers stored in this browser. It does not contact us, and it does not change anything on a government site.' }),
      el('button', { class: 'btn btn-secondary', type: 'button', id: 'delete-answers-confirm', hidden: true, text: 'Confirm delete' }),
    );
    return wrap;
  }

  function showError(form, message) {
    const errorBox = form.querySelector('#question-error');
    errorBox.hidden = false;
    errorBox.textContent = message;
    errorBox.focus();
  }

  function wire(form, state) {
    form.querySelector('#question-back')?.addEventListener('click', () => {
      const answers = readForm(form, state.answers);
      const saved = writeGuideState(stores, { step: state.step - 1, answers, checks: readGuideState(stores).checks });
      if (!saved.ok) {
        showError(form, saved.error);
        return;
      }
      render();
      formFocus();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const answers = readForm(form, state.answers);
      const result = validateStep(state.step, answers);
      if (result.errors.length) {
        showError(form, result.errors[0]);
        return;
      }
      const stop = routeMessage(result.route.reason);
      if (stop) {
        const saved = writeGuideState(stores, { step: 0, answers, checks: readGuideState(stores).checks });
        if (!saved.ok) {
          showError(form, saved.error);
          return;
        }
        showStop(form, stop);
        window.dispatchEvent(new CustomEvent('guide-saved'));
        return;
      }
      const nextStep = Math.min(state.step + 1, STEP_COUNT - 1);
      const saved = writeGuideState(stores, { step: state.step === STEP_COUNT - 1 ? state.step : nextStep, answers, checks: readGuideState(stores).checks });
      if (!saved.ok) {
        showError(form, saved.error);
        return;
      }
      window.dispatchEvent(new CustomEvent('guide-saved'));
      if (state.step === STEP_COUNT - 1) {
        render();
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.querySelector('#summary')?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
        return;
      }
      render();
      formFocus();
    });

    form.querySelector('#delete-answers')?.addEventListener('click', () => {
      form.querySelector('#delete-note').hidden = false;
      const confirm = form.querySelector('#delete-answers-confirm');
      confirm.hidden = false;
      confirm.focus();
    });
    form.querySelector('#delete-answers-confirm')?.addEventListener('click', () => {
      clearGuideState(stores);
      window.dispatchEvent(new CustomEvent('guide-saved'));
      render();
      formFocus();
    });
  }

  function showStop(form, message) {
    const existing = form.querySelector('#route-stop');
    existing?.remove();
    const note = el('div', { id: 'route-stop', class: 'callout', role: 'status', tabindex: '-1' });
    note.append(
      el('p', { text: message }),
      el('a', { class: 'btn btn-primary', href: 'https://register.business.gov.au/', target: '_blank', rel: 'noopener noreferrer', text: 'Continue on the free official application' }),
    );
    note.querySelector('a').append(el('span', { class: 'sr-only', text: ' (opens in a new tab)' }));
    form.querySelector('.cta-row')?.before(note);
    note.focus();
  }

  function formFocus() {
    const title = mount.querySelector('#question-title');
    if (title) {
      title.setAttribute('tabindex', '-1');
      title.focus();
    }
  }

  window.addEventListener('guide-cleared', () => render());
  render();
  const email = deliverPackByEmail();
  const emailNote = document.querySelector('#email-stub');
  if (emailNote && !email.sent) emailNote.textContent = email.detail;
}

const paidMount = document.querySelector('#guide-app[data-paid="true"]');
if (paidMount) mountQuestionnaire(paidMount);
