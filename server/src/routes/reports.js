const express = require('express');
const {
  addReport,
  getReports,
  getReportDetails,
  findMessageById,
  findUserById,
  resolveReport,
  deleteReport
} = require('../db');
const { requireBrand } = require('../utils/brandContext');

const router = express.Router();

router.post('/', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  const { messageId, userId, reason } = req.body;
  if (!messageId || !userId) {
    return res.status(400).json({ error: 'messageId and userId are required' });
  }
  const message = findMessageById(messageId);
  const user = findUserById(userId);
  if (!message || !user) {
    return res.status(404).json({ error: 'Message or user not found' });
  }
  try {
    const report = addReport({ messageId, userId, reason, brandId: brand.id });
    res.json({ report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  const requesterId = req.query.requesterId;
  if (!requesterId) {
    return res.status(400).json({ error: 'requesterId es requerido' });
  }
  const requester = findUserById(requesterId);
  if (!requester) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  try {
    const reports = getReports(brand.id);
    const visibleReports = requester.role === 'admin'
      ? reports
      : reports.filter((report) => report.user_id === requesterId);
    res.json({ reports: visibleReports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:reportId/resolve', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const existing = getReportDetails(req.params.reportId);
    if (!existing || existing.brand_id !== brand.id) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    const report = resolveReport({
      reportId: req.params.reportId,
      resolvedBy: req.body.resolvedBy
    });
    res.json({ report });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:reportId', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const { requesterId } = req.body || {};
    if (!requesterId) {
      return res.status(400).json({ error: 'requesterId es requerido' });
    }
    const requester = findUserById(requesterId);
    if (!requester) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const report = getReportDetails(req.params.reportId);
    if (!report) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    if (report.brand_id !== brand.id) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    const canDelete = requester.role === 'admin' || report.user_id === requesterId;
    if (!canDelete) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    deleteReport(req.params.reportId);
    res.json({ ok: true });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
