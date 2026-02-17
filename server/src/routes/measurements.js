const express = require('express');
const {
  getMeasurementsDashboard,
  runDailyRecommendationMeasurements
} = require('../services/recommendationMeasurementService');
const { requireBrand } = require('../utils/brandContext');

const router = express.Router();

router.get('/summary', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const { startDate, endDate } = req.query;
    const summary = getMeasurementsDashboard({ startDate, endDate, brandId: brand.id });
    res.json(summary);
  } catch (error) {
    console.error('Error obteniendo resumen de mediciones', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/run', async (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const { measurementDate, sampleSize, force } = req.body || {};
    const payload = {};
    if (measurementDate) {
      payload.measurementDate = measurementDate;
    }
    if (sampleSize !== undefined) {
      const parsed = parseInt(sampleSize, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        payload.sampleSize = parsed;
      }
    }
    if (force !== undefined) {
      payload.force = Boolean(force);
    }
    payload.brandId = brand.id;
    const result = await runDailyRecommendationMeasurements(payload);
    res.json(result);
  } catch (error) {
    console.error('Error ejecutando mediciones manuales', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
