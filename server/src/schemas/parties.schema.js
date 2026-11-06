const { z } = require('zod');

const createPartySchema = z.object({
  name: z.string().min(1, 'Party name is required'),
});

const updatePartySchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  version: z.number().int().min(1, 'Version is required for concurrency check'),
});

module.exports = {
  createPartySchema,
  updatePartySchema,
};

