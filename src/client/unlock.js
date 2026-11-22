const params = new URLSearchParams(location.search);
const error = document.querySelector('#form-error');
const cancelled = document.querySelector('#cancelled-note');
const messages = {
  acknowledge: 'Tick the box to confirm you understand the disclosure.',
  config: 'Payments are not configured on this server yet. Nothing was charged.',
  payment: 'The payment page could not be opened. Nothing was charged from this site.',
};
if (params.get('cancelled') === '1' && cancelled) cancelled.hidden = false;
if (messages[params.get('error')] && error) {
  error.hidden = false;
  error.textContent = messages[params.get('error')];
}
