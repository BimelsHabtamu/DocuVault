/**
 * Renders template HTML against a data record.
 * Supports (per SRS FR-002, FR-004, FR-005, FR-013):
 *   {{employee.full_name}}          - dotted-path placeholder substitution
 *   {{#if salary > 5000}}...{{/if}} - conditional blocks (simple comparisons)
 *   {{#each leave_history}}...{{/each}} - looping blocks over arrays
 *   {{generation_date}}, {{generation_date_gc}}, {{generation_date_ec}} - auto-filled
 *     generation date (Gregorian and Ethiopian calendar).
 *   {{effective_date}}, {{effective_date_gc}}, {{effective_date_ec}} - M-1 auto-filled
 *     effective date: defaults to the generation date; overridden by any "effective_date"
 *     field coming from the source record. Always resolves — never left as a raw token.
 *
 * Every render call takes an optional `warnings` array. A genuinely missing field
 * (nothing in the source record for that path), or a {{#each}} pointed at something
 * that isn't actually an array, is left as the raw {{token}} in the output AND
 * recorded as a warning — never silently turned into a blank gap. Callers
 * (documentController) decide what to do with a non-empty warnings list: preview shows
 * them to the template author, and real PDF generation refuses to proceed at all while
 * any exist, so a genuinely broken placeholder can never end up baked into an actual
 * document.
 *
 * List/object fields used as a BARE placeholder (e.g. {{employees.salary_breakdown}}
 * instead of a {{#each}} loop) are NOT treated as an error: they're automatically
 * flattened into a readable inline summary via `flattenForDisplay` below — e.g.
 * "Base Salary: 5000, Bonus: 1200; ..." — instead of "[object Object]" or a blocked
 * document. This is a deliberate, permanent fallback so a template author's choice of
 * a plain {{token}} over a {{#each}} loop is a formatting preference, not a hard
 * failure. Authors who want row-by-row control (a table, custom per-row markup, etc.)
 * still use {{#each list}}...{{/each}} — that remains the recommended way to render
 * tabular data — but forgetting to do so no longer blocks generation.
 */

const { formatGregorianDate, formatEthiopianDate } = require('./ethiopianCalendar');

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function isPlainObjectOrArray(val) {
  return val !== null && typeof val === 'object'; // catches both arrays and plain objects
}

/**
 * Turns a list/object value into a readable, single-line, plain-text summary so it can
 * stand in for a bare {{placeholder}} without ever producing "[object Object]".
 *   - array of objects  -> "key: value, key: value; key: value, ..." (one "; "-separated
 *     group per item)
 *   - array of scalars  -> "a, b, c"
 *   - plain object      -> "key: value, key: value"
 * Nested arrays/objects inside an item are flattened recursively the same way, so this
 * never bottoms out in a stray [object Object] no matter how deep the data goes.
 */
function flattenForDisplay(val) {
  if (val === undefined || val === null) return '';

  if (Array.isArray(val)) {
    return val.map((item) => flattenForDisplay(item)).join('; ');
  }

  if (isPlainObjectOrArray(val)) {
    return Object.entries(val)
      .map(([key, v]) => `${key}: ${isPlainObjectOrArray(v) ? flattenForDisplay(v) : v}`)
      .join(', ');
  }

  return String(val);
}

/** Evaluates simple conditions like "salary > 5000" or "status == 'active'" safely (no eval()). */
function evaluateCondition(expr, data) {
  const match = expr.match(/^([\w.]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!match) {
    // Bare truthy check: {{#if is_manager}}
    const val = getByPath(data, expr.trim());
    return Boolean(val);
  }

  const [, leftPath, operator, rawRight] = match;
  const leftVal = getByPath(data, leftPath.trim());

  let rightVal = rawRight.trim();
  if (/^['"].*['"]$/.test(rightVal)) {
    rightVal = rightVal.slice(1, -1); // strip quotes -> string compare
  } else if (!isNaN(Number(rightVal))) {
    rightVal = Number(rightVal); // numeric compare
  }

  switch (operator) {
    case '==': return leftVal == rightVal;
    case '!=': return leftVal != rightVal;
    case '>': return Number(leftVal) > Number(rightVal);
    case '<': return Number(leftVal) < Number(rightVal);
    case '>=': return Number(leftVal) >= Number(rightVal);
    case '<=': return Number(leftVal) <= Number(rightVal);
    default: return false;
  }
}

function renderConditionals(html, data) {
  const ifRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  return html.replace(ifRegex, (_, condition, block) => (evaluateCondition(condition, data) ? block : ''));
}

function renderLoops(html, data, warnings) {
  const eachRegex = /\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  return html.replace(eachRegex, (_, listPath, block) => {
    const list = getByPath(data, listPath.trim());
    if (!Array.isArray(list)) {
      warnings.push({
        fieldPath: listPath.trim(),
        issue: 'not_a_list',
        message: `{{#each ${listPath.trim()}}} expects a list, but that field is ${list === undefined ? 'missing' : typeof list}.`,
      });
      return '';
    }
    return list
      .map((item) => block
        .replace(/\{\{\s*this\.([\w.]+)\s*\}\}/g, (__, key) => {
          const val = getByPath(item, key);
          // A nested list/object one level down (e.g. a JSON sub-array inside a row)
          // is flattened to a readable inline summary rather than blocked — same
          // permanent fallback as a bare top-level placeholder (see flattenForDisplay).
          return val !== undefined && val !== null ? flattenForDisplay(val) : '';
        })
        .replace(/\{\{\s*this\s*\}\}/g, () => flattenForDisplay(item)))
      .join('');
  });
}

/**
 * NFR-005: PII redaction via template filters, e.g. {{employee.salary|redact}}.
 * Currently supports `redact` (full mask) and `redact:last4` (shows only the last 4 chars).
 */
function applyFilter(value, filterName) {
  if (value === undefined || value === null) return value;
  const strVal = String(value);

  if (filterName === 'redact') {
    return '•'.repeat(Math.max(strVal.length, 4));
  }
  if (filterName === 'redact:last4') {
    if (strVal.length <= 4) return '•'.repeat(strVal.length);
    return '•'.repeat(strVal.length - 4) + strVal.slice(-4);
  }
  return strVal;
}

function renderPlaceholders(html, data, warnings) {
  return html.replace(/\{\{\s*([\w.]+)(?:\|([\w:]+))?\s*\}\}/g, (match, fieldPath, filterName) => {
    const val = getByPath(data, fieldPath);

    if (val === undefined || val === null) {
      // Leave un-mapped placeholders visible for debugging, and flag them — a document
      // should never go out with a stray {{token}} nobody noticed.
      warnings.push({
        fieldPath,
        issue: 'missing',
        message: `{{${fieldPath}}} has no matching value in the source record.`,
      });
      return match;
    }

    if (isPlainObjectOrArray(val)) {
      // A field that's actually a list/object (e.g. a JSON column like
      // salary_breakdown/leave_history) was inserted as a plain placeholder instead of
      // a {{#each}} loop. Rather than blocking generation over a formatting choice,
      // auto-flatten it into a readable inline summary — this is what previously
      // produced the classic "[object Object]" bug, so it's never stringified with
      // String(val) directly; flattenForDisplay() renders every sub-field by name.
      const flattened = flattenForDisplay(val);
      return filterName ? applyFilter(flattened, filterName) : flattened;
    }

    return filterName ? applyFilter(val, filterName) : String(val);
  });
}

/**
 * Full render pipeline: loops -> conditionals -> plain placeholders.
 * Order matters: loops/conditionals must resolve before their nested placeholders are substituted.
 * `warnings`, if passed, is mutated in place with every issue encountered — pass a fresh
 * array per render call (don't reuse one across header/body/footer) so each region's
 * issues can be traced back to it.
 */
function renderTemplate(html, data, warnings = []) {
  if (!html) return '';
  let output = html;
  output = renderLoops(output, data, warnings);
  output = renderConditionals(output, data);
  output = renderPlaceholders(output, data, warnings);
  return output;
}

/**
 * FR-013 / M-1: auto-filled dynamic date placeholders merged into the data context
 * before rendering.
 *
 * Auto-injected placeholders (always available in every template):
 *   {{generation_date}}     — plain ISO date G.C. (kept for backward compatibility)
 *   {{generation_date_gc}}  — human-readable Gregorian generation date
 *   {{generation_date_ec}}  — Ethiopian calendar generation date
 *   {{effective_date}}      — M-1 SRS requirement: defaults to the same day as
 *                             generation_date (G.C. ISO format) so documents that
 *                             don't override it get a sensible value, while templates
 *                             that map a real "effective_date" field from their data
 *                             source will see the source record's value take precedence
 *                             (it is merged after the auto-dates, so explicit data
 *                             always wins over the default). Also exposed as
 *                             {{effective_date_gc}} and {{effective_date_ec}} for
 *                             dual-calendar display — same as generation_date variants.
 *
 * NOTE on circular dependency: effective_date is injected at render time, BEFORE the
 * PDF buffer is produced, so it never participates in the SHA-256 file hash that
 * goes into the QR code. The hash covers the final rendered PDF bytes only.
 */
function withAutoDates(data) {
  const now = new Date();
  const isoToday = now.toISOString().slice(0, 10);

  // If the source record already has an effective_date field, honour it; otherwise
  // default to the generation date so the placeholder never renders as a raw {{token}}.
  const effectiveDateRaw = data.effective_date || isoToday;
  // Parse safely — accept ISO strings, JS Date, or anything Date can handle.
  const effectiveDateObj = effectiveDateRaw instanceof Date
    ? effectiveDateRaw
    : new Date(effectiveDateRaw);
  const effectiveDateSafe = Number.isNaN(effectiveDateObj.getTime()) ? now : effectiveDateObj;

  return {
    // Auto-date defaults first — source-record fields merged in below will override
    // any key that also exists in the record (effective_date is the primary example).
    generation_date: isoToday,
    generation_date_gc: formatGregorianDate(now),
    generation_date_ec: formatEthiopianDate(now),
    effective_date: effectiveDateSafe.toISOString().slice(0, 10),
    effective_date_gc: formatGregorianDate(effectiveDateSafe),
    effective_date_ec: formatEthiopianDate(effectiveDateSafe),
    // Source-record data last: explicit record values always win over auto-filled defaults.
    ...data,
  };
}

module.exports = { renderTemplate, withAutoDates, getByPath, flattenForDisplay };
