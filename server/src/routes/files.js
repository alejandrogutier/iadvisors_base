const express = require('express');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { toFile } = require('openai');
const { client } = require('../openaiClient');
const { requireBrand } = require('../utils/brandContext');
const { resolveVectorStoreId } = require('../services/vectorStoreResolver');

const uploadDir = path.join(os.tmpdir(), 'iadvisors_uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });
const router = express.Router();

router.get('/', async (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const vectorStoreId = await resolveVectorStoreId(brand);
    const files = await client.vectorStores.files.list(vectorStoreId);
    const normalizedFiles = await Promise.all(
      files.data.map(async (file) => {
        if (file.attributes?.filename) {
          return file;
        }
        try {
          const originalFile = await client.files.retrieve(file.id);
          return {
            ...file,
            attributes: {
              ...(file.attributes || {}),
              filename: originalFile.filename
            }
          };
        } catch (err) {
          return file;
        }
      })
    );
    res.json({ files: normalizedFiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', upload.single('file'), async (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) {
    if (req.file?.path) {
      fs.rm(req.file.path, { force: true }, () => {});
    }
    return;
  }
  if (!req.file) {
    return res.status(400).json({ error: 'file is required' });
  }
  try {
    const uploadableFile = await toFile(
      fs.createReadStream(req.file.path),
      req.file.originalname
    );
    const vectorStoreId = await resolveVectorStoreId(brand);
    let vectorStoreFile = await client.vectorStores.files.uploadAndPoll(vectorStoreId, uploadableFile);

    if (vectorStoreFile.status !== 'completed') {
      const message =
        vectorStoreFile.last_error?.message || 'OpenAI no pudo procesar el archivo';
      return res.status(400).json({ error: message, file: vectorStoreFile });
    }

    if (req.file.originalname) {
      const attributes = {
        ...(vectorStoreFile.attributes || {}),
        filename: req.file.originalname
      };
      try {
        vectorStoreFile = await client.vectorStores.files.update(vectorStoreFile.id, {
          vector_store_id: vectorStoreId,
          attributes
        });
      } catch (err) {
        vectorStoreFile = {
          ...vectorStoreFile,
          attributes
        };
      }
    }

    res.json({ file: vectorStoreFile });
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    res.status(500).json({ error: message });
  } finally {
    fs.rm(req.file.path, { force: true }, () => {});
  }
});

router.delete('/:fileId', async (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const vectorStoreId = await resolveVectorStoreId(brand);
    await client.vectorStores.files.delete(req.params.fileId, {
      vector_store_id: vectorStoreId
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
