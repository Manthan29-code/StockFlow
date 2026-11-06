const express = require('express');
const router = express.Router();
const datasetService = require('../services/dataset.service');
const { auth } = require('../middleware/auth');

// 36. GET /dataset (S)
router.get('/dataset', auth, async (req, res, next) => {
  try {
    const dataset = await datasetService.buildDataset(false);
    res.json(dataset);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

