const express = require('express');
const multer = require('multer');
const os = require('os');
const fs = require('fs');
const path = require('path');
const {
  sendMessage,
  createThread,
  listThreads,
  getThreadMessagesForUser,
  renameThread
} = require('../services/assistantService');
const { getThreadById, getLatestThreadForUser } = require('../db');
const { getCommunicationProfilesSummary } = require('../data/communicationProfiles');
const { requireBrand } = require('../utils/brandContext');

const router = express.Router();

const uploadDir = path.join(os.tmpdir(), 'iadvisors_chat_uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 6 * 1024 * 1024 // 6 MB
  }
});

const parseJSONField = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

function toImageAttachment(file) {
  if (!file) return null;
  const supported = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!supported.includes(file.mimetype)) {
    const error = new Error('Formato de imagen no soportado. Usa PNG, JPEG, WEBP o GIF.');
    error.code = 'UNSUPPORTED_IMAGE_FORMAT';
    throw error;
  }

  const bytes = fs.readFileSync(file.path);
  return {
    filename: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    bytesBase64: bytes.toString('base64')
  };
}

router.get('/:userId/history', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const { threadId } = req.query;
    const targetThread = threadId
      ? getThreadById(threadId)
      : getLatestThreadForUser(req.params.userId, brand.id);
    if (!targetThread || targetThread.brand_id !== brand.id) {
      return res.json({ messages: [], threadId: null });
    }
    const messages = getThreadMessagesForUser({
      threadId: targetThread.id,
      userId: req.params.userId,
      brandId: brand.id
    });
    res.json({ messages, threadId: targetThread.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/communication-profiles', (req, res) => {
  try {
    res.json({ profiles: getCommunicationProfilesSummary() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/message', upload.single('image'), async (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) {
    if (req.file?.path) {
      fs.rm(req.file.path, { force: true }, () => {});
    }
    return;
  }

  const body = req.body || {};
  const userId = body.userId;
  const threadId = body.threadId;
  const rawMessage = body.message;
  const formatContext = typeof body.formatContext === 'string' ? body.formatContext : null;
  let displayMetadata = parseJSONField(body.displayMetadata);
  const communicationProfile = parseJSONField(body.communicationProfile);
  const trimmedMessage = typeof rawMessage === 'string' ? rawMessage.trim() : '';

  const cleanupTempFile = () => {
    if (req.file?.path) {
      fs.rm(req.file.path, { force: true }, () => {});
    }
  };

  if (!userId) {
    cleanupTempFile();
    return res.status(400).json({ error: 'userId es requerido' });
  }

  if (!trimmedMessage && !req.file) {
    cleanupTempFile();
    return res.status(400).json({ error: 'Debes enviar un mensaje o adjuntar una imagen' });
  }

  let imageAttachment = null;
  if (req.file) {
    try {
      imageAttachment = toImageAttachment(req.file);
    } catch (error) {
      cleanupTempFile();
      if (error.code === 'UNSUPPORTED_IMAGE_FORMAT') {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: `No se pudo procesar la imagen: ${error.message}` });
    } finally {
      cleanupTempFile();
    }
  }

  if (imageAttachment) {
    displayMetadata =
      typeof displayMetadata === 'object' && displayMetadata !== null
        ? displayMetadata
        : {};
    displayMetadata.imageFilename = imageAttachment.filename;
    displayMetadata.imageSize = imageAttachment.size;
    displayMetadata.imageMimeType = imageAttachment.mimeType;
  }

  try {
    const response = await sendMessage({
      userId,
      brand,
      message: trimmedMessage,
      threadId,
      displayMetadata,
      formatContext,
      communicationProfile,
      imageAttachment
    });
    res.json(response);
  } catch (error) {
    console.error('Error in sendMessage:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:userId/threads', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const threads = listThreads(req.params.userId, brand.id);
    res.json({ threads });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/thread', async (req, res) => {
  const { userId, title } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const thread = await createThread({ userId, brand, title });
    res.json({ thread });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/thread/:threadId', (req, res) => {
  const { userId, title } = req.body;
  if (!userId || !title) {
    return res.status(400).json({ error: 'userId y title son requeridos' });
  }
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const updated = renameThread({
      threadId: req.params.threadId,
      userId,
      brandId: brand.id,
      title
    });
    res.json({ thread: updated });
  } catch (error) {
    if (error.code === 'THREAD_NOT_FOUND') {
      return res.status(404).json({ error: 'No tienes acceso a este chat' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/thread/:threadId/messages', (req, res) => {
  try {
    const thread = getThreadById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }
    const messages = getThreadMessagesForUser({
      threadId: thread.id,
      userId: req.query.userId || thread.user_id
    });
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
