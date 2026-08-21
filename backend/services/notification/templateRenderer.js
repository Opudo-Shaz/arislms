const logger = require('../../config/logger');

/**
 * templateRenderer — replaces `{{var}}` placeholders in a template string with
 * values from a shared context object. Used by notificationDispatcher to render
 * the same context into each channel's body/subject.
 */

/**
 * @param {string} body - Template string containing `{{var}}` placeholders
 * @param {object} context - Shared variable context, e.g. { clientName, amount, dueDate }
 * @returns {string} Rendered string. Missing variables are left as-is (placeholder kept)
 *                    and logged as a warning so template/context mismatches are visible.
 */
function render(body, context = {}) {
  if (!body) return body;
  const missing = [];

  const rendered = body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(context, key) && context[key] != null) {
      return String(context[key]);
    }
    missing.push(key);
    return match;
  });

  if (missing.length > 0) {
    logger.warn(`[templateRenderer] Missing context variable(s): ${missing.join(', ')}`);
  }

  return rendered;
}

module.exports = { render };
