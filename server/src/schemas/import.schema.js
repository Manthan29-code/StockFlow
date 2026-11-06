const { z } = require('zod');

const commitMaterialImportSchema = z.object({
  entries: z.array(
    z.object({
      inDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      challanNo: z.string().min(1),
      quantity: z.string().or(z.number()),
      supplier: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      outgoingRows: z.array(
        z.object({
          outDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          challanNo: z.string().min(1),
          rowNo: z.number().int().optional(),
          qty: z.string().or(z.number()),
          pieceWeight: z.string().or(z.number()).nullable().optional(),
          specValue: z.string().nullable().optional(),
        })
      ).default([]),
    })
  ).min(1, 'At least one incoming entry must be provided'),
});

const commitBomImportSchema = z.object({
  items: z.array(
    z.object({
      partyName: z.string().min(1),
      productName: z.string().min(1),
      materialId: z.string().uuid(),
      consumption: z.string().or(z.number()),
      specValue: z.string().nullable().optional(),
    })
  ).min(1, 'At least one BOM line item must be provided'),
});

module.exports = {
  commitMaterialImportSchema,
  commitBomImportSchema,
};

