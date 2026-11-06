const { z } = require('zod');

const createProductSchema = z.object({
  partyId: z.string().uuid('Valid partyId is required'),
  name: z.string().min(1, 'Product name is required'),
  notes: z.string().nullable().optional(),
});

const updateProductSchema = z.object({
  partyId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  version: z.number().int().min(1, 'Version is required for concurrency check'),
});

module.exports = {
  createProductSchema,
  updateProductSchema,
};

