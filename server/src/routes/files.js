const express = require('express');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const {
  listBrandDocuments,
  createBrandDocument,
  findBrandDocumentById,
  updateBrandDocumentIngestion,
  softDeleteBrandDocument
} = require('../db');
const { requireBrand } = require('../utils/brandContext');
const { s3Client } = require('../aws/s3Client');
const {
  resolveKbBucket,
  resolveKbS3Prefix,
  startKnowledgeBaseIngestionJob
} = require('../services/knowledgeBaseService');

const uploadDir = path.join(os.tmpdir(), 'iadvisors_uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });
const router = express.Router();

function toUnixTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / 1000);
}

function toApiFile(record) {
  return {
    id: record.id,
    status: record.status,
    usage_bytes: record.size_bytes,
    created_at: toUnixTimestamp(record.created_at),
    attributes: {
      filename: record.filename,
      s3_bucket: record.s3_bucket,
      s3_key: record.s3_key,
      knowledge_base_id: record.knowledge_base_id,
      data_source_id: record.data_source_id
    }
  };
}

function sanitizeFilename(filename = '') {
  return String(filename)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 180);
}

router.get('/', async (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const files = listBrandDocuments(brand.id).map(toApiFile);
    res.json({ files });
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

  const bucket = resolveKbBucket();
  if (!bucket) {
    fs.rm(req.file.path, { force: true }, () => {});
    return res.status(500).json({ error: 'KB_BUCKET no está configurado en el backend' });
  }

  const prefix = resolveKbS3Prefix(brand.id, brand.kbS3Prefix);
  const safeFilename = sanitizeFilename(req.file.originalname || req.file.filename || 'documento');
  const objectKey = `${prefix}${Date.now()}-${safeFilename}`;

  try {
    const body = fs.readFileSync(req.file.path);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: body,
        ContentType: req.file.mimetype || 'application/octet-stream'
      })
    );

    const saved = createBrandDocument({
      brandId: brand.id,
      knowledgeBaseId: brand.knowledgeBaseId || null,
      dataSourceId: brand.kbDataSourceId || null,
      s3Bucket: bucket,
      s3Key: objectKey,
      filename: req.file.originalname || safeFilename,
      contentType: req.file.mimetype,
      sizeBytes: req.file.size,
      status: 'uploaded'
    });

    let current = saved;
    if (brand.knowledgeBaseId && brand.kbDataSourceId) {
      try {
        const ingestionJob = await startKnowledgeBaseIngestionJob({
          knowledgeBaseId: brand.knowledgeBaseId,
          dataSourceId: brand.kbDataSourceId
        });

        current = updateBrandDocumentIngestion({
          id: saved.id,
          status: ingestionJob?.status || 'ingesting',
          ingestionJobId: ingestionJob?.ingestionJobId || null,
          lastError: null
        });
      } catch (error) {
        current = updateBrandDocumentIngestion({
          id: saved.id,
          status: 'ingestion_failed',
          ingestionJobId: null,
          lastError: error.message
        });
      }
    } else {
      current = updateBrandDocumentIngestion({
        id: saved.id,
        status: 'pending_kb',
        ingestionJobId: null,
        lastError: 'La marca no tiene knowledgeBaseId o kbDataSourceId configurado'
      });
    }

    res.json({ file: toApiFile(current || saved) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    fs.rm(req.file.path, { force: true }, () => {});
  }
});

router.delete('/:fileId', async (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;

  try {
    const existing = findBrandDocumentById(req.params.fileId);
    if (!existing || existing.brand_id !== brand.id || existing.deleted_at) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: existing.s3_bucket,
        Key: existing.s3_key
      })
    );

    softDeleteBrandDocument(existing.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
