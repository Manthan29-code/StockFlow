const { z } = require('zod');
const { ROLES } = require('@stockflow/shared');

const createUserSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum([ROLES.ADMIN, ROLES.STAFF]).default(ROLES.STAFF),
  color: z.string().optional(),
});

const updateUserSchema = z.object({
  role: z.enum([ROLES.ADMIN, ROLES.STAFF]).optional(),
  isActive: z.boolean().optional(),
  color: z.string().optional(),
  version: z.number().int().min(1, 'Version is required for concurrency check'),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
};

