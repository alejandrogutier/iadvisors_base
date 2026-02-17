const express = require('express');
const { listBrands, createBrand, updateBrand } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    res.json({ brands: listBrands() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const brand = createBrand(req.body || {});
    res.status(201).json({ brand });
  } catch (error) {
    if (error.code === 'BRAND_CONFIG_INCOMPLETE') {
      return res.status(400).json({ error: 'assistantId y vectorStoreId son requeridos' });
    }
    if (error.code === 'BRAND_NOT_FOUND') {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:brandId', (req, res) => {
  try {
    const brand = updateBrand(req.params.brandId, req.body || {});
    res.json({ brand });
  } catch (error) {
    if (error.code === 'BRAND_NOT_FOUND') {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }
    if (error.code === 'BRAND_CONFIG_INCOMPLETE') {
      return res.status(400).json({ error: 'assistantId y vectorStoreId son requeridos' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
