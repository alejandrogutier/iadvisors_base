const { client } = require('../openaiClient');
const { updateBrand } = require('../db');

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

async function fetchAssistantVectorStoreId(assistantId) {
  if (!assistantId) return null;
  try {
    const assistant = await client.beta.assistants.retrieve(assistantId);
    return assistant?.tool_resources?.file_search?.vector_store_ids?.[0] || null;
  } catch (error) {
    console.error('No se pudo obtener el assistant de OpenAI:', error.message);
    return null;
  }
}

async function resolveVectorStoreId(brand) {
  if (!brand) {
    throw new Error('Marca inválida');
  }

  const cached = cache.get(brand.id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.vectorStoreId;
  }

  const assistantVectorStoreId = await fetchAssistantVectorStoreId(brand.assistantId);
  const resolvedId = assistantVectorStoreId || brand.vectorStoreId;
  if (!resolvedId) {
    throw new Error('La marca no tiene vector store configurado');
  }

  if (assistantVectorStoreId && assistantVectorStoreId !== brand.vectorStoreId) {
    try {
      updateBrand(brand.id, { vectorStoreId: assistantVectorStoreId });
    } catch (error) {
      console.warn(
        'No se pudo sincronizar el vector store de la marca',
        brand.id,
        error.message
      );
    }
  }

  cache.set(brand.id, {
    vectorStoreId: resolvedId,
    expiresAt: Date.now() + CACHE_TTL_MS
  });

  return resolvedId;
}

module.exports = {
  resolveVectorStoreId
};
