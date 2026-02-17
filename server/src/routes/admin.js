const crypto = require('crypto');
const express = require('express');
const { ListFoundationModelsCommand } = require('@aws-sdk/client-bedrock');
const {
  listUsersWithStats,
  createUser,
  sanitizeUser,
  updateUserRole,
  deleteUser,
  listAllMessages,
  listMessagesByUser,
  findUserById,
  getUserBrands,
  setUserBrands,
  findUserByEmail,
  updateBrand
} = require('../db');
const { requireBrand } = require('../utils/brandContext');
const { bedrockClient } = require('../aws/bedrockClient');
const {
  createUserInCognito,
  updateUserRoleInCognito,
  deleteUserInCognito
} = require('../services/cognitoAuthService');

const router = express.Router();

function randomLocalPassword() {
  return `local-${crypto.randomBytes(24).toString('hex')}`;
}

function normalizeRole(role) {
  if (role === 'admin') return 'admin';
  if (role === 'analyst') return 'analyst';
  return 'user';
}

function buildAssistantPayload(brand) {
  const settings = brand.assistantSettings || {};
  return {
    id: brand.id,
    name: brand.name,
    description: brand.description || '',
    instructions: settings.instructions || '',
    model: brand.modelId || null,
    temperature:
      typeof settings.temperature === 'number' && !Number.isNaN(settings.temperature)
        ? settings.temperature
        : null,
    top_p:
      typeof settings.topP === 'number' && !Number.isNaN(settings.topP)
        ? settings.topP
        : null,
    max_tokens:
      typeof settings.maxTokens === 'number' && !Number.isNaN(settings.maxTokens)
        ? settings.maxTokens
        : null,
    guardrail_id: brand.guardrailId || null,
    knowledge_base_id: brand.knowledgeBaseId || null,
    knowledge_base_status: brand.knowledgeBaseStatus || null,
    tool_resources: {
      knowledge_base: {
        knowledge_base_id: brand.knowledgeBaseId || null,
        data_source_id: brand.kbDataSourceId || null,
        s3_prefix: brand.kbS3Prefix || null
      }
    },
    tools: brand.knowledgeBaseId ? [{ type: 'knowledge_base_retrieval' }] : [],
    updated_at: Date.now()
  };
}

async function listAvailableModels() {
  const fallbackModels = (process.env.BEDROCK_AVAILABLE_MODELS || process.env.BEDROCK_MODEL_ID_DEFAULT || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((id) => ({ id, providerName: 'configured', outputModalities: ['TEXT'] }));

  try {
    const response = await bedrockClient.send(
      new ListFoundationModelsCommand({
        byOutputModality: 'TEXT'
      })
    );
    const models = Array.isArray(response?.modelSummaries) ? response.modelSummaries : [];
    const normalized = models
      .filter((model) => model?.modelId)
      .map((model) => ({
        id: model.modelId,
        providerName: model.providerName || null,
        inputModalities: model.inputModalities || [],
        outputModalities: model.outputModalities || [],
        status: model.modelLifecycle?.status || null
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    if (normalized.length) {
      return normalized;
    }
    return fallbackModels;
  } catch (error) {
    console.error('No se pudieron listar modelos de Bedrock', error.message);
    return fallbackModels;
  }
}

router.get('/users', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const users = listUsersWithStats(brand.id).map((user) => ({
      ...user,
      brands: getUserBrands(user.id)
    }));
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/messages', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const records = listAllMessages(brand.id).map((message) => {
      let metadata = null;
      if (message.display_metadata) {
        try {
          metadata = JSON.parse(message.display_metadata);
        } catch (error) {
          metadata = message.display_metadata;
        }
      }
      return {
        id: message.id,
        role: message.role,
        content: message.content,
        created_at: message.created_at,
        thread_id: message.thread_id,
        thread_title: message.thread_title,
        user: {
          id: message.user_id,
          name: message.user_name,
          email: message.user_email
        },
        metadata
      };
    });
    res.json({ messages: records });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/users/:userId/messages', (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  const { userId } = req.params;
  const user = findUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  try {
    const records = listMessagesByUser(userId, brand.id).map((message) => {
      let metadata = null;
      if (message.display_metadata) {
        try {
          metadata = JSON.parse(message.display_metadata);
        } catch (error) {
          metadata = message.display_metadata;
        }
      }
      return {
        id: message.id,
        role: message.role,
        content: message.content,
        created_at: message.created_at,
        thread_id: message.thread_id,
        thread_title: message.thread_title,
        metadata
      };
    });
    res.json({ user: sanitizeUser(user), messages: records });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/users', async (req, res) => {
  const { name, email, password, role, brandIds, defaultBrandId } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedRole = normalizeRole(role);

  try {
    if (findUserByEmail(normalizedEmail)) {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }

    await createUserInCognito({
      email: normalizedEmail,
      name,
      password,
      role: normalizedRole
    });

    const user = createUser({
      name,
      email: normalizedEmail,
      password: randomLocalPassword(),
      role: normalizedRole,
      enforceRole: true
    });

    if (Array.isArray(brandIds) && brandIds.length) {
      setUserBrands(user.id, brandIds, defaultBrandId || brandIds[0]);
    }

    res.json({ user: sanitizeUser(findUserById(user.id)) });
  } catch (error) {
    if (error.code === 'EMAIL_EXISTS') {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }
    if (error.code === 'BRAND_NOT_FOUND') {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }
    if (error.code === 'COGNITO_NOT_CONFIGURED') {
      return res.status(500).json({ error: 'Cognito no está configurado en el backend' });
    }
    if (error.code === 'COGNITO_USER_EXISTS') {
      return res.status(409).json({ error: 'El usuario ya existe en Cognito' });
    }
    if (error.code === 'INVALID_NEW_PASSWORD') {
      return res.status(400).json({ error: 'La contraseña no cumple la política de Cognito' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.patch('/users/:userId/role', async (req, res) => {
  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ error: 'El rol es requerido' });
  }
  const normalizedRole = normalizeRole(role);

  try {
    const existing = findUserById(req.params.userId);
    if (!existing) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await updateUserRoleInCognito({
      email: existing.email,
      role: normalizedRole
    });

    const updated = updateUserRole({ userId: req.params.userId, role: normalizedRole });
    res.json({ user: sanitizeUser(updated) });
  } catch (error) {
    if (error.code === 'INVALID_ROLE') {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (error.code === 'LAST_ADMIN') {
      return res.status(409).json({ error: 'Debe existir al menos un administrador' });
    }
    if (error.code === 'COGNITO_NOT_CONFIGURED') {
      return res.status(500).json({ error: 'Cognito no está configurado en el backend' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.patch('/users/:userId/brands', (req, res) => {
  const { brandIds, defaultBrandId } = req.body || {};
  try {
    setUserBrands(req.params.userId, Array.isArray(brandIds) ? brandIds : [], defaultBrandId || null);
    const updated = findUserById(req.params.userId);
    res.json({ user: sanitizeUser(updated) });
  } catch (error) {
    if (error.code === 'BRAND_CONFIG_INCOMPLETE') {
      return res.status(400).json({ error: 'Información de marca incompleta' });
    }
    if (error.code === 'BRAND_NOT_FOUND') {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/users/:userId', async (req, res) => {
  try {
    const existing = findUserById(req.params.userId);
    if (!existing) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await deleteUserInCognito({ email: existing.email });
    deleteUser(req.params.userId);
    res.json({ ok: true });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (error.code === 'LAST_ADMIN') {
      return res.status(409).json({ error: 'Debe existir al menos un administrador' });
    }
    if (error.code === 'COGNITO_NOT_CONFIGURED') {
      return res.status(500).json({ error: 'Cognito no está configurado en el backend' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/assistant', async (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const models = await listAvailableModels();
    const assistant = buildAssistantPayload(brand);
    res.json({ assistant, models });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/assistant', async (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;

  const {
    model,
    instructions,
    temperature,
    top_p: topP,
    max_tokens: maxTokens,
    guardrail_id: guardrailId,
    knowledge_base_id: knowledgeBaseId,
    knowledge_base_status: knowledgeBaseStatus
  } = req.body || {};

  const updates = {};
  if (typeof model === 'string' && model.trim()) {
    updates.modelId = model.trim();
    updates.assistantId = model.trim();
  }
  if (typeof instructions === 'string') {
    updates.assistantInstructions = instructions;
  }
  if (typeof temperature === 'number' && !Number.isNaN(temperature)) {
    updates.assistantTemperature = temperature;
  }
  if (typeof topP === 'number' && !Number.isNaN(topP)) {
    updates.assistantTopP = topP;
  }
  if (typeof maxTokens === 'number' && !Number.isNaN(maxTokens)) {
    updates.assistantMaxTokens = maxTokens;
  }
  if (typeof guardrailId === 'string') {
    updates.guardrailId = guardrailId.trim() || null;
  }
  if (typeof knowledgeBaseId === 'string') {
    updates.knowledgeBaseId = knowledgeBaseId.trim() || null;
    updates.vectorStoreId = knowledgeBaseId.trim() || null;
  }
  if (typeof knowledgeBaseStatus === 'string') {
    updates.knowledgeBaseStatus = knowledgeBaseStatus.trim() || null;
  }

  if (!Object.keys(updates).length) {
    return res
      .status(400)
      .json({ error: 'No se recibió ningún parámetro para actualizar' });
  }

  try {
    const updatedBrand = updateBrand(brand.id, updates);
    const assistant = buildAssistantPayload(updatedBrand);
    res.json({ assistant });
  } catch (error) {
    if (error.code === 'BRAND_NOT_FOUND') {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
