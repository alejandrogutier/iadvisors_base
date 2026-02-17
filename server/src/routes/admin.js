const express = require('express');
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
  listBrands,
  setUserBrands
} = require('../db');
const { client } = require('../openaiClient');
const { requireBrand } = require('../utils/brandContext');

const ASSISTANT_MODEL_PREFIXES = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'];
const DISALLOWED_MODEL_KEYWORDS = [
  'dall-e',
  'tts',
  'audio',
  'image',
  'vision',
  'whisper',
  'realtime',
  'search',
  'transcribe',
  'codex',
  'o1',
  'o3',
  'o4'
];

function isAssistantCompatibleModel(modelId = '') {
  const normalized = modelId.toLowerCase();
  if (!normalized) {
    return false;
  }
  if (DISALLOWED_MODEL_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return false;
  }
  if (normalized.startsWith('ft:')) {
    return true;
  }
  return ASSISTANT_MODEL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}


async function listAvailableModels() {
  try {
    const response = await client.models.list();
    if (!response?.data) {
      return [];
    }
    return response.data.map((model) => ({
      id: model.id,
      created: model.created,
      owned_by: model.owned_by
    }));
  } catch (error) {
    console.error('No se pudieron consultar los modelos disponibles', error);
    return [];
  }
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }
  const normalized = {};
  Object.entries(metadata).forEach(([key, value]) => {
    const trimmedKey = typeof key === 'string' ? key.trim() : '';
    if (!trimmedKey) return;
    normalized[trimmedKey] = value == null ? '' : String(value);
  });
  return normalized;
}

function sanitizeTools(tools) {
  if (!Array.isArray(tools)) {
    return undefined;
  }
  const normalized = tools
    .map((tool) => {
      if (!tool || typeof tool !== 'object' || typeof tool.type !== 'string') {
        return null;
      }
      return {
        ...tool,
        type: tool.type
      };
    })
    .filter(Boolean);
  return normalized;
}

function sanitizeToolResources(toolResources) {
  if (!toolResources || typeof toolResources !== 'object' || Array.isArray(toolResources)) {
    return undefined;
  }
  const normalized = {};
  Object.entries(toolResources).forEach(([key, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    if (key === 'file_search') {
      const vectorIds = Array.isArray(value.vector_store_ids)
        ? value.vector_store_ids
            .map((id) => (typeof id === 'string' ? id.trim() : ''))
            .filter(Boolean)
        : [];
      normalized.file_search = {
        ...value,
        vector_store_ids: vectorIds
      };
    } else {
      normalized[key] = value;
    }
  });
  return normalized;
}

function normalizeResponseFormat(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'default') {
      return null;
    }
    return { type: trimmed };
  }
  if (typeof value === 'object') {
    return value;
  }
  return undefined;
}

const router = express.Router();

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

router.post('/users', (req, res) => {
  const { name, email, password, role, brandIds, defaultBrandId } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos' });
  }
  try {
    const user = createUser({ name, email, password, role });
    if (Array.isArray(brandIds) && brandIds.length) {
      setUserBrands(user.id, brandIds, defaultBrandId || brandIds[0]);
    }
    res.json({ user: sanitizeUser(findUserById(user.id)) });
  } catch (error) {
    if (error.code === 'EMAIL_EXISTS') {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }
    if (error.code === 'PASSWORD_REQUIRED') {
      return res.status(400).json({ error: 'La contraseña es requerida' });
    }
    if (error.code === 'BRAND_NOT_FOUND') {
      return res.status(404).json({ error: 'Marca no encontrada' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.patch('/users/:userId/role', (req, res) => {
  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ error: 'El rol es requerido' });
  }
  try {
    const updated = updateUserRole({ userId: req.params.userId, role });
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

router.delete('/users/:userId', (req, res) => {
  try {
    deleteUser(req.params.userId);
    res.json({ ok: true });
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (error.code === 'LAST_ADMIN') {
      return res.status(409).json({ error: 'Debe existir al menos un administrador' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/assistant', async (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  try {
    const assistant = await client.beta.assistants.retrieve(brand.assistantId);
    const models = await listAvailableModels();
    res.json({ assistant, models });
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    const status = error.response?.status || error.status || 500;
    res.status(status).json({ error: message });
  }
});

router.put('/assistant', async (req, res) => {
  const brand = requireBrand(req, res);
  if (!brand) return;
  const {
    name,
    description,
    instructions,
    model,
    temperature,
    top_p: topP,
    metadata,
    tools,
    response_format: responseFormat,
    tool_resources: toolResources
  } = req.body;

  const updates = {};
  if (typeof name === 'string') {
    updates.name = name;
  }
  if (typeof description === 'string') {
    updates.description = description;
  }
  if (typeof instructions === 'string') {
    updates.instructions = instructions;
  }
  if (typeof model === 'string') {
    if (!isAssistantCompatibleModel(model)) {
      return res.status(400).json({ error: 'El modelo no es compatible con la API de asistentes' });
    }
    updates.model = model;
  }
  if (typeof temperature === 'number' && !Number.isNaN(temperature)) {
    updates.temperature = temperature;
  }
  if (typeof topP === 'number' && !Number.isNaN(topP)) {
    updates.top_p = topP;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'metadata')) {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      updates.metadata = sanitizeMetadata(metadata);
    } else if (metadata == null) {
      updates.metadata = {};
    } else {
      return res.status(400).json({ error: 'metadata debe ser un objeto' });
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'tools')) {
    if (!Array.isArray(tools)) {
      return res.status(400).json({ error: 'tools debe ser un arreglo' });
    }
    updates.tools = sanitizeTools(tools);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'tool_resources')) {
    if (toolResources && typeof toolResources === 'object' && !Array.isArray(toolResources)) {
      updates.tool_resources = sanitizeToolResources(toolResources);
    } else if (toolResources == null) {
      updates.tool_resources = {};
    } else {
      return res.status(400).json({ error: 'tool_resources debe ser un objeto' });
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'response_format')) {
    const normalizedResponseFormat = normalizeResponseFormat(responseFormat);
    if (normalizedResponseFormat === undefined) {
      return res.status(400).json({ error: 'response_format inválido' });
    }
    updates.response_format = normalizedResponseFormat;
  }

  if (!Object.keys(updates).length) {
    return res
      .status(400)
      .json({ error: 'No se recibió ningún parámetro para actualizar' });
  }

  try {
    const assistant = await client.beta.assistants.update(brand.assistantId, updates);
    res.json({ assistant });
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    const status = error.response?.status || error.status || 500;
    res.status(status).json({ error: message });
  }
});

module.exports = router;
