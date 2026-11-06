const express = require('express');
const router = express.Router();
const metaRepo = require('../repositories/meta.repo');
const { auth } = require('../middleware/auth');

// 35. GET /sync/revision (S)
router.get('/sync/revision', auth, async (req, res, next) => {
  try {
    const revision = await metaRepo.getRevision();
    res.json({ revision });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

