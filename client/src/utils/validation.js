/**
 * Shared, dependency-free form validation helpers.
 *
 * Single source of truth for the rules used across DocuVault forms so the same
 * checks (required fields, email format, min length, password match, …) are never
 * re-implemented per page. Every validator takes the field value and returns an
 * error message string, or an empty string when the value is valid.
 *
 * Validators intentionally return strings (not booleans) so a page can pass the
 * result straight into the FieldError component without a second lookup table.
 */

/** Message helpers — consistent wording everywhere. */
export const messages = {
  required: (label = 'This field') => `Please enter ${label.toLowerCase()}.`,
  select: (label = 'an option') => `Please select ${label.toLowerCase()}.`,
  invalidEmail: () => 'Please enter a valid email address.',
  minLength: (label, min) => `${label} must be at least ${min} characters.`,
  tooLong: (label, max) => `${label} must be no more than ${max} characters.`,
  mismatch: (label = 'Those values') => `${label} do not match.`,
  invalidFormat: (label, expected = 'a valid value') => `${label} must be ${expected}.`,
  atLeastOne: (label = 'an item') => `Please choose at least one ${label}.`,
};

/** True when a value is present (whitespace trimmed). */
export function isRequired(value) {
  return String(value ?? '').trim().length > 0;
}

/** True when a value looks like an email address. */
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());
}

/** Returns the minimum-length error message, or '' when the value is long enough. */
export function validateMinLength(value, min, label) {
  return String(value ?? '').length < min ? messages.minLength(label, min) : '';
}

/** Returns the max-length error message, or '' when the value fits. */
export function validateMaxLength(value, max, label) {
  return String(value ?? '').length > max ? messages.tooLong(label, max) : '';
}

/** Returns '' when `a === b`, otherwise the generic mismatch message. */
export function validateMatch(a, b, label = 'Passwords') {
  return a === b ? '' : messages.mismatch(label);
}

/** Composite required + email rule. Returns the first failing message. */
export function emailRule(value, { requiredMsg } = {}) {
  return isRequired(value)
    ? (isValidEmail(value) ? '' : messages.invalidEmail())
    : (requiredMsg ?? messages.required('The email'));
}

/** Composite required rule with optional email format. */
export function requiredRule(value, label = 'The value', { email } = {}) {
  if (!isRequired(value)) return messages.required(label);
  if (email && !isValidEmail(value)) return messages.invalidEmail();
  return '';
}

/**
 * Validators pre-bound to field labels for use with useFormValidation's rules map:
 *
 *   rules: {
 *     email: (v) => emailRule(v),
 *     password: (v) => isRequired(v) ? '' : 'Please enter your password.',
 *   }
 */
export const validators = { isRequired, isValidEmail, validateMinLength, validateMaxLength, validateMatch, emailRule, requiredRule };