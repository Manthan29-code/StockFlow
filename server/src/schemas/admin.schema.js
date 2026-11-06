const { z } = require('zod');

const restoreSchema = z.object({
  formatVersion: z.literal(1, {
    errorMap: () => ({ message: 'Invalid or unsupported formatVersion (expected 1)' }),
  }),
  exportedAt: z.string().optional(),
  revision: z.number().int().optional(),
  data: z.object({
    users: z.array(z.any()),
    units: z.array(z.any()),
    materials: z.array(z.any()),
    incoming_entries: z.array(z.any()),
    outgoing_transactions: z.array(z.any()),
    parties: z.array(z.any()),
    products: z.array(z.any()),
    bom_lines: z.array(z.any()),
    audit_log: z.array(z.any()).optional().default([]),
  }),
});

const auditQuerySchema = z.object({
  entity: z.string().optional(),
  userId: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});

module.exports = {
  restoreSchema,
  auditQuerySchema,
};

