const express = require('express');
const {
  createFollowUpEntry,
  updateFollowUpEntry,
  deleteFollowUpEntry,
  listFollowUps,
  findFollowUpById,
  findUserById
} = require('../db');
const { requireBrand } = require('../utils/brandContext');

const router = express.Router();

function canManageFollowUp({ followUp, requesterId, requesterRole }) {
  if (!followUp) return false;
  if (requesterRole === 'admin') return true;
  return followUp.user_id === requesterId;
}

router.get('/', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  const { userId, role, view, status, startDate, endDate, ownerId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId es requerido' });
  }

  const includeAll = role === 'admin' && view === 'all';

  try {
    const records = listFollowUps({
      includeAll,
      userId,
      ownerId: includeAll ? ownerId : null,
      status,
      startDate,
      endDate,
      brandId: brand.id
    }).map((item) => ({
      ...item,
      user: item.user_id
        ? {
            id: item.user_id,
            name: item.user_name,
            email: item.user_email
          }
        : null
    }));
    res.json({ followups: records });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  const { userId, scheduledAt, platform, platformOther, postUrl, status, comments } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId es requerido' });
  }
  const user = findUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  try {
    const record = createFollowUpEntry({
      userId,
      brandId: brand.id,
      scheduledAt,
      platform,
      platformOther,
      postUrl,
      status,
      comments
    });
    res.json({ followup: record });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:followUpId', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  const { followUpId } = req.params;
  const { requesterId, requesterRole, scheduledAt, platform, platformOther, postUrl, status, comments } = req.body;
  if (!requesterId) {
    return res.status(400).json({ error: 'requesterId es requerido' });
  }
  const existing = findFollowUpById(followUpId);
  if (!existing) {
    return res.status(404).json({ error: 'Registro no encontrado' });
  }
  if (!canManageFollowUp({ followUp: existing, requesterId, requesterRole })) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  try {
    const updated = updateFollowUpEntry({
      id: followUpId,
      brandId: brand.id,
      scheduledAt,
      platform,
      platformOther,
      postUrl,
      status,
      comments
    });
    res.json({ followup: updated });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:followUpId', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  const { followUpId } = req.params;
  const { requesterId, requesterRole } = req.body || {};
  if (!requesterId) {
    return res.status(400).json({ error: 'requesterId es requerido' });
  }
  const existing = findFollowUpById(followUpId);
  if (!existing) {
    return res.status(404).json({ error: 'Registro no encontrado' });
  }
  if (existing.brand_id !== brand.id) {
    return res.status(404).json({ error: 'Registro no encontrado' });
  }
  if (!canManageFollowUp({ followUp: existing, requesterId, requesterRole })) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  try {
    deleteFollowUpEntry(followUpId);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
