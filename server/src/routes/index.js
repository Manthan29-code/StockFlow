const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const unitsRoutes = require('./units.routes');
const materialsRoutes = require('./materials.routes');
const partiesRoutes = require('./parties.routes');
const productsRoutes = require('./products.routes');
const bomRoutes = require('./bom.routes');
const incomingRoutes = require('./incoming.routes');
const outgoingRoutes = require('./outgoing.routes');
const stockRoutes = require('./stock.routes');
const syncRoutes = require('./sync.routes');
const datasetRoutes = require('./dataset.routes');
const adminRoutes = require('./admin.routes');
const importRoutes = require('./import.routes');
const healthRoutes = require('./health.routes');

router.use(authRoutes);
router.use(usersRoutes);
router.use(unitsRoutes);
router.use(materialsRoutes);
router.use(partiesRoutes);
router.use(productsRoutes);
router.use(bomRoutes);
router.use(incomingRoutes);
router.use(outgoingRoutes);
router.use(stockRoutes);
router.use(syncRoutes);
router.use(datasetRoutes);
router.use(adminRoutes);
router.use(importRoutes);
router.use(healthRoutes);

module.exports = router;

