const { z } = require('zod');

const createIncomingSchema = z.object({
  materialId: z.string().uuid('Valid materialId is required'),
  inDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'inDate must be in YYYY-MM-DD format'),
  challanNo: z.string().min(1, 'Challan number is required'),
  quantity: z.string().or(z.number()).refine((val) => Number(val) > 0, {
    message: 'Quantity must be greater than zero',
  }),
  supplier: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const updateIncomingSchema = z.object({
  materialId: z.string().uuid().optional(),
  inDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'inDate must be in YYYY-MM-DD format').optional(),
  challanNo: z.string().min(1).optional(),
  quantity: z.string().or(z.number()).refine((val) => Number(val) > 0, {
    message: 'Quantity must be greater than zero',
  }).optional(),
  supplier: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  version: z.number().int().min(1, 'Version is required for concurrency check'),
});

module.exports = {
  createIncomingSchema,
  updateIncomingSchema,
};

