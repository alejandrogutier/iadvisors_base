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
const { client } = require('../openaiClient');
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

router.get('/:userId/history', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const { threadId } = req.query;
    let targetThread = threadId
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
  const tempFilePath = req.file?.path;
  const cleanupTempFile = () => {
    if (tempFilePath) {
      fs.rm(tempFilePath, { force: true }, () => { });
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
    if (!req.file.mimetype?.startsWith('image/')) {
      cleanupTempFile();
      return res.status(400).json({ error: 'Solo se aceptan archivos de imagen' });
    }
    let finalPath = tempFilePath;
    try {
      // OpenAI requires the file to have an extension to detect the type
      const originalName = req.file.originalname;
      const ext = path.extname(originalName);
      if (ext) {
        finalPath = `${tempFilePath}${ext}`;
        fs.renameSync(tempFilePath, finalPath);
      }

      const uploaded = await client.files.create({
        file: fs.createReadStream(finalPath),
        purpose: 'vision'
      });
      imageAttachment = {
        fileId: uploaded.id,
        filename: req.file.originalname,
        size: req.file.size
      };
    } catch (error) {
      if (finalPath && finalPath !== tempFilePath) {
        fs.rm(finalPath, { force: true }, () => { });
      } else {
        cleanupTempFile();
      }
      const message = error.response?.data?.error?.message || error.message;
      console.error('Error uploading file to OpenAI:', error);
      return res.status(500).json({ error: `No se pudo subir la imagen: ${message}` });
    }

    if (finalPath && finalPath !== tempFilePath) {
      fs.rm(finalPath, { force: true }, () => { });
    } else {
      cleanupTempFile();
    }
  }

  if (imageAttachment) {
    displayMetadata = typeof displayMetadata === 'object' && displayMetadata !== null
      ? displayMetadata
      : {};
    displayMetadata.imageFilename = imageAttachment.filename;
    displayMetadata.imageFileId = imageAttachment.fileId;
    displayMetadata.imageSize = imageAttachment.size;
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
