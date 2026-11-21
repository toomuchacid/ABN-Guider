const params = new URLSearchParams(location.search);
const error = document.querySelector('#feedback-error');
if (params.get('error') === '1' && error) error.hidden = false;
