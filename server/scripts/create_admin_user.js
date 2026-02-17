#!/usr/bin/env node
/* eslint-disable no-console */
require('dotenv').config({ path: process.env.ADMIN_ENV_PATH || undefined });

const path = require('path');
const fs = require('fs');

// Asegura que las rutas relativas (como DATABASE_PATH) se resuelvan desde /server
process.chdir(path.resolve(__dirname, '..'));

const { createUser, findUserByEmail, sanitizeUser } = require('../src/db');

const args = process.argv.slice(2).reduce((acc, arg) => {
  if (!arg.startsWith('--')) return acc;
  const [key, value = ''] = arg.replace(/^--/, '').split('=');
  acc[key] = value;
  return acc;
}, {});

const name = args.name || process.env.DEFAULT_ADMIN_NAME || 'Administrador IAdvisors';
const email = args.email || process.env.DEFAULT_ADMIN_EMAIL;
const password = args.password || process.env.DEFAULT_ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Debe proporcionar --email y --password (o definir DEFAULT_ADMIN_EMAIL/DEFAULT_ADMIN_PASSWORD).');
  process.exit(1);
}

const existing = findUserByEmail(email);
if (existing) {
  console.error(`Ya existe un usuario con el correo ${email}.`);
  process.exit(1);
}

const created = createUser({ name, email, password, role: 'admin' });
const safeUser = sanitizeUser(created);

console.log('Usuario administrador creado:');
console.log(JSON.stringify({ id: safeUser.id, email: safeUser.email, role: safeUser.role }, null, 2));

if (process.env.DEFAULT_ADMIN_PASSWORD_FILE) {
  fs.writeFileSync(process.env.DEFAULT_ADMIN_PASSWORD_FILE, password, { flag: 'w', mode: 0o600 });
  console.log(`Contraseña almacenada en ${process.env.DEFAULT_ADMIN_PASSWORD_FILE}`);
}
