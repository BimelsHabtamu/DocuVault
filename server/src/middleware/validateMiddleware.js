

const { ZodError } = require('zod');
const AppError     = require('../utils/AppError');

/**
 * Express middleware factory.
 * @param {import('zod').ZodTypeAny} schema  - Zod schema to validate against
 * @param {'body'|'params'|'query'} [source] - Which part of req to validate (default: 'body')
 * @returns {import('express').RequestHandler}
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      // Flatten Zod errors into { field: [messages] } for easy UI consumption
      const fieldErrors = result.error.flatten().fieldErrors;

      // Build a human-readable summary for the top-level message
      const firstField   = Object.keys(fieldErrors)[0];
      const firstMessage = firstField
        ? `${firstField}: ${fieldErrors[firstField][0]}`
        : 'Validation failed';

      return next(AppError.validation(firstMessage, { fields: fieldErrors }));
    }

    // Replace with parsed data (Zod strips unknown keys and coerces types)
    req[source] = result.data;
    next();
  };
}

/**
 * Validate multiple sources in one middleware array.
 * @param {{ body?: ZodSchema, params?: ZodSchema, query?: ZodSchema }} schemas
 * @returns {import('express').RequestHandler[]}
 */
function validateAll(schemas) {
  return Object.entries(schemas).map(([source, schema]) => validate(schema, source));
}

module.exports = { validate, validateAll };
