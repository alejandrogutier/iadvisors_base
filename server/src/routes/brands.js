const express = require('express');
const { listBrands, createBrand, updateBrand } = require('../db');
const {
  provisionBrandKnowledgeBase,
  inferKnowledgeBaseStatus
} = require('../services/knowledgeBaseService');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    res.json({ brands: listBrands() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};
    let brand = createBrand(payload);

    try {
      const provisioned = await provisionBrandKnowledgeBase({
        brandId: brand.id,
        brandName: brand.name,
        modelId: brand.modelId,
        existingKnowledgeBaseId: brand.knowledgeBaseId,
        existingDataSourceId: brand.kbDataSourceId,
        kbS3Prefix: brand.kbS3Prefix
      });

      brand = updateBrand(brand.id, {
        modelId: provisioned.modelId || brand.modelId,
        assistantId: provisioned.modelId || brand.modelId,
        knowledgeBaseId: provisioned.knowledgeBaseId,
        vectorStoreId: provisioned.knowledgeBaseId,
        knowledgeBaseStatus:
          provisioned.knowledgeBaseStatus || inferKnowledgeBaseStatus(provisioned.knowledgeBaseId),
        kbDataSourceId: provisioned.kbDataSourceId,
        kbS3Prefix: provisioned.kbS3Prefix
      });
    } catch (provisionError) {
      console.error('No se pudo provisionar Knowledge Base para la marca', provisionError.message);
      brand = updateBrand(brand.id, {
        knowledgeBaseStatus: 'FAILED'
      });
    }

    res.status(201).json({ brand });
  } catch (error) {
    if (error.code === 'BRAND_CONFIG_INCOMPLETE') {
      return res.status(400).json({ error: 'modelId es requerido' });
    }
    if (error.code === 'BRAND_NOT_FOUND') {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:brandId', async (req, res) => {
  try {
    let brand = updateBrand(req.params.brandId, req.body || {});

    if (!brand.knowledgeBaseId || !brand.kbDataSourceId) {
      try {
        const provisioned = await provisionBrandKnowledgeBase({
          brandId: brand.id,
          brandName: brand.name,
          modelId: brand.modelId,
          existingKnowledgeBaseId: brand.knowledgeBaseId,
          existingDataSourceId: brand.kbDataSourceId,
          kbS3Prefix: brand.kbS3Prefix
        });

        brand = updateBrand(brand.id, {
          modelId: provisioned.modelId || brand.modelId,
          assistantId: provisioned.modelId || brand.modelId,
          knowledgeBaseId: provisioned.knowledgeBaseId,
          vectorStoreId: provisioned.knowledgeBaseId,
          knowledgeBaseStatus:
            provisioned.knowledgeBaseStatus || inferKnowledgeBaseStatus(provisioned.knowledgeBaseId),
          kbDataSourceId: provisioned.kbDataSourceId,
          kbS3Prefix: provisioned.kbS3Prefix
        });
      } catch (provisionError) {
        console.error('No se pudo completar el provisionamiento de la marca', provisionError.message);
      }
    }

    res.json({ brand });
  } catch (error) {
    if (error.code === 'BRAND_NOT_FOUND') {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }
    if (error.code === 'BRAND_CONFIG_INCOMPLETE') {
      return res.status(400).json({ error: 'modelId es requerido' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
