const { z } = require('zod');
const { DEDUCT_BY } = require('@stockflow/shared');

const createMaterialSchema = z.object({
  name: z.string().min(1, 'Material name is required'),
  unitId: z.string().uuid('Valid unitId is required'),
  deductBy: z.enum([DEDUCT_BY.DIRECT, DEDUCT_BY.QTY_X_PIECE_WEIGHT]),
  specLabel: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const updateMaterialSchema = z.object({
  name: z.string().min(1).optional(),
  unitId: z.string().uuid().optional(),
  deductBy: z.enum([DEDUCT_BY.DIRECT, DEDUCT_BY.QTY_X_PIECE_WEIGHT]).optional(),
  specLabel: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  version: z.number().int().min(1, 'Version is required for concurrency check'),
});

module.exports = {
  createMaterialSchema,
  updateMaterialSchema,
};

