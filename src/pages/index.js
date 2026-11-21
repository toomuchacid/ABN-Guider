import { renderFeedback, renderFeedbackRejected, renderFeedbackThanks } from './feedback.js';
import { renderGuide } from './guide.js';
import { renderHome } from './home.js';
import { renderLegal } from './legal.js';
import { renderNotFound } from './misc.js';
import { renderNameCheck } from './name-check.js';
import { renderReport } from './report.js';
import { renderUnlock } from './unlock.js';

export function allPages() {
  return [
    { file: 'index.html', html: renderHome() },
    { file: 'name-check.html', html: renderNameCheck() },
    { file: 'guide.html', html: renderGuide() },
    { file: 'unlock.html', html: renderUnlock() },
    { file: 'report.html', html: renderReport() },
    { file: 'terms.html', html: renderLegal('terms') },
    { file: 'privacy.html', html: renderLegal('privacy') },
    { file: 'disclaimer.html', html: renderLegal('disclaimer') },
    { file: 'refunds.html', html: renderLegal('refunds') },
    { file: 'feedback.html', html: renderFeedback() },
    { file: 'feedback/thanks.html', html: renderFeedbackThanks() },
    { file: 'feedback/rejected.html', html: renderFeedbackRejected() },
    { file: '404.html', html: renderNotFound() },
  ];
}
