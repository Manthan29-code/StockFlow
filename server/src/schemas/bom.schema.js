const { z } = require('zod');

const createBomLineSchema = z.object({
  materialId: z.string().uuid('Valid materialId is required'),
  consumption: z.string().or(z.number()).refine((val) => Number(val) > 0, {
    message: 'Consumption must be greater than zero',
  }),
  specValue: z.string().nullable().optional(),
});

const updateBomLineSchema = z.object({
  consumption: z.string().or(z.number()).refine((val) => Number(val) > 0, {
    message: 'Consumption must be greater than zero',
  }).optional(),
  specValue: z.string().nullable().optional(),
  version: z.number().int().min(1, 'Version is required for concurrency check'),
});

module.exports = {
  createBomLineSchema,
  updateBomLineSchema,
};

