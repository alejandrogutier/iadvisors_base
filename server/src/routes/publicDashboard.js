const express = require('express');
const { getPublicDashboardStats } = require('../db');
const { requireBrand } = require('../utils/brandContext');

const router = express.Router();

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  parsed.setUTCHours(0, 0, 0, 0);
  return parsed;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeRange(query = {}) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let end = parseDate(query.endDate) || today;
  let start = parseDate(query.startDate);
  if (!start) {
    start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 29);
  }
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  return {
    startDate: formatDateOnly(start),
    endDate: formatDateOnly(end)
  };
}

router.get('/', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const { startDate, endDate } = normalizeRange(req.query);
    const limit = req.query?.limit ? parseInt(req.query.limit, 10) : undefined;
    const stats = getPublicDashboardStats({ startDate, endDate, limit, brandId: brand.id });
    res.json({
      range: { startDate, endDate },
      ...stats
    });
  } catch (error) {
    console.error('Error generando dashboard público', error);
    res.status(500).json({ error: 'No se pudo cargar el dashboard público' });
  }
});

module.exports = router;
