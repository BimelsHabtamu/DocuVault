import { useState, useCallback } from 'react';

/**
 * Per-field form validation state for inline (popup-free) validation.
 *
 *   const { errors, runValidation, setFieldError, fieldProps, clearFieldError } = useFormValidation();
 *
 *   const handleSubmit = (e) => {
 *     e.preventDefault();
 *     const ok = runValidation({
 *       firstName: (v) => requiredRule(v, 'The full name'),
 *       email:     (v) => emailRule(v),
 *       password:  (v) => validateMinLength(v, 8, 'Password'),
 *     }, values);
 *     if (!ok) { focusFirstInvalid(...); return; }
 *     // submit…
 *   };
 *
 *   <form noValidate>
 *     <label htmlFor="firstName">Full Name <RequiredMark /></label>
 *     <input
 *       id="firstName"
 *       {...fieldProps('firstName')}   // className="field-invalid" + aria-invalid + aria-describedby
 *       onChange={(e) => { setValue({ firstName: e.target.value }); clearFieldError('firstName'); }}
 *     />
 *     <FieldError id="firstName-error" message={errors.firstName} />
 *   </form>
 *
 * Clearing: errors are cleared via clearFieldError on change so they disappear the
 * moment the user fixes the value. A value that is still invalid can optionally be
 * re-validated live via `onLiveValidate` (see below).
 */
export default function useFormValidation() {
  const [errors, setErrors] = useState({});

  /** Set an individual field error, e.g. from a server response. */
  const setFieldError = useCallback((name, message) => {
    setErrors((prev) => ({ ...prev, [name]: message }));
  }, []);

  const clearFieldError = useCallback((...names) => {
    setErrors((prev) => {
      if (names.length === 0) return {};
      const next = { ...prev };
      for (const name of names) delete next[name];
      return next;
    });
  }, []);

  /**
   * Validate a rules map against the current values.
   * rules: { [fieldName]: (value) => string /* error message or '' *\/ }
   * Returns true when every rule passes; keeps only failing fields in state.
   */
  const runValidation = useCallback((rules, values) => {
    const next = {};
    for (const [name, check] of Object.entries(rules)) {
      const message = check(values ? values[name] : undefined);
      if (message) next[name] = message;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, []);

  /**
   * Props to spread onto the input/select: error styling + ARIA wiring.
   * When the field is invalid, optionally re-check live so the error clears on fix.
   */
  const fieldProps = useCallback((name, opts = {}) => {
    const message = errors[name];
    const props = {
      'aria-invalid': message ? true : undefined,
      ...(message && opts.errorId ? { 'aria-describedby': opts.errorId } : {}),
    };
    if (message && opts.className) {
      props.className = `${opts.className} field-invalid`;
    } else if (message) {
      props.className = 'field-invalid';
    }
    return props;
  }, [errors]);

  return { errors, runValidation, setFieldError, clearFieldError, fieldProps };
}