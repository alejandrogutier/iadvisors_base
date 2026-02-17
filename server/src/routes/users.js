const express = require('express');
const {
  createUser,
  findUserById,
  authenticateUser,
  sanitizeUser,
  setPasswordForExistingUser,
  updateUserProfile,
  changePassword
} = require('../db');

const router = express.Router();

router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: 'Name, email and password are required' });
  }
  try {
    const user = createUser({ name, email, password });
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    if (error.code === 'EMAIL_EXISTS') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const user = authenticateUser({ email, password });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/set-password', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: 'Email y nueva contraseña son requeridos' });
  }
  try {
    const updated = setPasswordForExistingUser({ email, password });
    res.json({ user: sanitizeUser(updated) });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (error.code === 'PASSWORD_ALREADY_SET') {
      return res.status(409).json({ error: 'El usuario ya tiene contraseña' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.put('/:userId', (req, res) => {
  const { name, email } = req.body;
  const { userId } = req.params;
  try {
    const updated = updateUserProfile({ id: userId, name, email });
    res.json({ user: sanitizeUser(updated) });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (error.code === 'EMAIL_EXISTS') {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/change-password', (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;
  if (!userId || !currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: 'userId, contraseña actual y nueva contraseña son requeridos' });
  }
  try {
    changePassword({ userId, currentPassword, newPassword });
    res.json({ ok: true });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (error.code === 'INVALID_PASSWORD') {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/:userId', (req, res) => {
  try {
    const user = findUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
