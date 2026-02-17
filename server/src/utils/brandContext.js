const { getBrandById } = require('../db');

function requireBrand(req, res) {
  const brandId = req.header('x-brand-id');
  if (!brandId) {
    res.status(400).json({ error: 'Encabezado X-Brand-Id es requerido' });
    return null;
  }
  const brand = getBrandById(brandId);
  if (!brand) {
    res.status(404).json({ error: 'Marca no encontrada' });
    return null;
  }
  req.brand = brand;
  return brand;
}

module.exports = {
  requireBrand
};
