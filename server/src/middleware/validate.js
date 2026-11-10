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
    if (source === 'query') {
      try {
        req.query = result.data;
      } catch {
        // In Express 5, req.query is a getter. Safely mutate the object it returns.
        if (req.query && typeof req.query === 'object') {
          for (const key of Object.keys(req.query)) {
            delete req.query[key];
          }
          Object.assign(req.query, result.data);
        }
      }
      req.validatedQuery = result.data;
    } else {
      req[source] = result.data;
    }
    next();
  };
}

module.exports = {
  validate,
};

