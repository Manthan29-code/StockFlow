const { z } = require('zod');

const createOutgoingSchema = z.object({
  incomingEntryId: z.string().uuid('Valid incomingEntryId is required'),
  outDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'outDate must be in YYYY-MM-DD format'),
  challanNo: z.string().min(1, 'Challan number is required'),
  qty: z.string().or(z.number()).refine((val) => Number(val) > 0, {
    message: 'Quantity must be greater than zero',
  }),
  pieceWeight: z.string().or(z.number()).nullable().optional(),
  specValue: z.string().nullable().optional(),
});

const updateOutgoingSchema = z.object({
  outDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'outDate must be in YYYY-MM-DD format').optional(),
  challanNo: z.string().min(1).optional(),
  qty: z.string().or(z.number()).refine((val) => Number(val) > 0, {
    message: 'Quantity must be greater than zero',
  }).optional(),
  pieceWeight: z.string().or(z.number()).nullable().optional(),
  specValue: z.string().nullable().optional(),
  version: z.number().int().min(1, 'Version is required for concurrency check'),
});

module.exports = {
  createOutgoingSchema,
  updateOutgoingSchema,
};

