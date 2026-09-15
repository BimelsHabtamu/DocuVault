/**
 * Small presentational pieces shared by every DocuVault form so inline
 * validation looks and behaves identically everywhere (no popups):
 *
 *   <label htmlFor="email">Email <RequiredMark /></label>
 *   <input id="email" {...fieldProps('email')} onChange={…} />
 *   <FieldError id="email-error" message={errors.email} />
 */

/** Red asterisk shown next to a required-field label. */
export function RequiredMark() {
  return <span className="required-mark" aria-hidden="true"> *</span>;
}

/**
 * Renders a field error directly below the input in the shared `.field-error`
 * style. Returns null when there is nothing to show, so callers can always keep
 * it in the DOM tree conditionally-free.
 */
export function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  );
}