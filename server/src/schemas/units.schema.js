const { z } = require('zod');

const createUnitSchema = z.object({
  code: z.string().min(1, 'Unit code is required').max(10),
  name: z.string().min(1, 'Unit name is required').max(50),
});

const updateUnitSchema = z.object({
  name: z.string().min(1, 'Unit name is required').max(50),
  version: z.number().int().min(1, 'Version is required for concurrency check'),
});

module.exports = {
  createUnitSchema,
  updateUnitSchema,
};

