const { ROLES } = require('@stockflow/shared');
const { ForbiddenError } = require('../utils/errors');

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== ROLES.ADMIN) {
    return next(ForbiddenError('Administrator access required'));
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return next(ForbiddenError(`Access requires ${role} role`));
    }
    next();
  };
}

module.exports = {
  requireAdmin,
  requireRole,
};

