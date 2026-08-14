const express = require('express');
const dashboardRepository = require('../repositories/dashboardRepository');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(dashboardRepository.findSummary());
});

module.exports = router;
