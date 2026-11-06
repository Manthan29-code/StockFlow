const express = require('express');
const router = express.Router();
const ledgerService = require('../services/ledger.service');
const { auth } = require('../middleware/auth');

// 34. GET /stock (S)
router.get('/stock', auth, async (req, res, next) => {
  try {
    const summary = await ledgerService.getStockSummary();
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

