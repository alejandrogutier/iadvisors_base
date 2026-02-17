const express = require('express');
const crypto = require('crypto');
const {
  createUser,
  findUserById,
  sanitizeUser,
  updateUserProfile,
  findUserByEmail,
  updateUserRole
} = require('../db');
const {
  authenticateWithCognito,
  changePasswordWithCognito
} = require('../services/cognitoAuthService');

const router = express.Router();

function mapAuthRole(role) {
  if (role === 'admin') return 'admin';
  if (role === 'analyst') return 'analyst';
  return 'user';
}

function randomLocalPassword() {
  return `local-${crypto.randomBytes(24).toString('hex')}`;
}

function displayNameFromEmail(email = '') {
  return email.split('@')[0] || 'Usuario IAdvisors';
}

function syncLocalUserFromIdentity(identity) {
  const normalizedEmail = String(identity?.email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    const error = new Error('IDENTITY_EMAIL_REQUIRED');
    error.code = 'IDENTITY_EMAIL_REQUIRED';
    throw error;
  }

  const identityRole = mapAuthRole(identity?.role);
  const identityName = String(identity?.name || '').trim() || displayNameFromEmail(normalizedEmail);
  let user = findUserByEmail(normalizedEmail);

  if (!user) {
    user = createUser({
      id: identity?.sub || undefined,
      name: identityName,
      email: normalizedEmail,
      password: randomLocalPassword(),
      role: identityRole,
      enforceRole: true
    });
  } else {
    if (identityName && identityName !== user.name) {
      user = updateUserProfile({ id: user.id, name: identityName, email: user.email });
    }
    if (user.role !== identityRole) {
      try {
        user = updateUserRole({ userId: user.id, role: identityRole });
      } catch (error) {
        if (error.code !== 'LAST_ADMIN') {
          throw error;
        }
      }
    }
  }

  return findUserById(user.id);
}

router.post('/register', (req, res) => {
  res.status(410).json({ error: 'Registro local deshabilitado. Usa usuarios gestionados en Cognito.' });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const identity = await authenticateWithCognito({ email, password });
    const user = syncLocalUserFromIdentity(identity);
    res.json({
      user: sanitizeUser(user)
    });
  } catch (error) {
    if (error.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    if (error.code === 'USER_NOT_CONFIRMED') {
      return res.status(403).json({ error: 'Usuario no confirmado en Cognito' });
    }
    if (error.code === 'PASSWORD_RESET_REQUIRED') {
      return res.status(409).json({ error: 'Debes restablecer la contraseña en Cognito' });
    }
    if (error.code === 'AUTH_CHALLENGE_REQUIRED') {
      return res.status(409).json({ error: 'El usuario requiere completar un challenge de Cognito' });
    }
    if (error.code === 'COGNITO_NOT_CONFIGURED') {
      return res.status(500).json({ error: 'Cognito no está configurado en el backend' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/set-password', (req, res) => {
  res.status(410).json({ error: 'Operación deshabilitada. Gestiona contraseñas en Cognito.' });
});

router.put('/:userId', (req, res) => {
  const { name, email } = req.body;
  const { userId } = req.params;
  const existing = findUserById(userId);
  if (!existing) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  if (email && email !== existing.email) {
    return res.status(400).json({ error: 'El correo se administra en Cognito y no puede editarse aquí' });
  }
  try {
    const updated = updateUserProfile({ id: userId, name, email: existing.email });
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

router.post('/change-password', async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;
  if (!userId || !currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: 'userId, contraseña actual y nueva contraseña son requeridos' });
  }
  try {
    const user = findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    await changePasswordWithCognito({
      email: user.email,
      currentPassword,
      newPassword
    });
    res.json({ ok: true });
  } catch (error) {
    if (error.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }
    if (error.code === 'INVALID_NEW_PASSWORD') {
      return res.status(400).json({ error: 'La nueva contraseña no cumple la política de Cognito' });
    }
    if (error.code === 'COGNITO_NOT_CONFIGURED') {
      return res.status(500).json({ error: 'Cognito no está configurado en el backend' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/resolve', (req, res) => {
  const rawEmail = req.query.email;
  const normalizedEmail = String(rawEmail || '')
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    return res.status(400).json({ error: 'email es requerido' });
  }

  try {
    const user = findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ user: sanitizeUser(user) });
  } catch (error) {
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
