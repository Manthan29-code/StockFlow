const { ValidationError } = require('../utils/errors');

/**
 * Validates request data using a Zod schema
 * @param {import('zod').ZodSchema} schema 
 * @param {'body'|'query'|'params'} source 
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.flatten().fieldErrors;
      const firstErrorMessage = result.error.errors[0]?.message || 'Validation failed';
      return next(ValidationError(firstErrorMessage, details));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = {
  validate,
};

