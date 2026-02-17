const { v4: uuid } = require('uuid');
const { ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const {
  saveMessage,
  createThreadRecord,
  getMessagesByThread,
  getThreadById,
  renameThread,
  listThreadsForUser,
  findUserById,
  getLatestThreadForUser,
  ensureUserBrandAccess,
  updateBrand
} = require('../db');
const { buildCommunicationProfileContext } = require('../data/communicationProfiles');
const { retrieveKnowledgeContext } = require('./knowledgeBaseService');
const { bedrockRuntimeClient } = require('../aws/bedrockRuntimeClient');

const SAFE_FALLBACK_MODEL_ID = 'us.amazon.nova-lite-v1:0';

function ensureThreadOwnership(threadId, userId, brandId) {
  const thread = getThreadById(threadId);
  if (!thread || thread.user_id !== userId || (brandId && thread.brand_id !== brandId)) {
    const err = new Error('THREAD_NOT_FOUND');
    err.code = 'THREAD_NOT_FOUND';
    throw err;
  }
  return thread;
}

function extractAssistantText(contentBlocks = []) {
  if (!Array.isArray(contentBlocks)) {
    return '';
  }
  return contentBlocks
    .map((item) => {
      if (typeof item?.text === 'string') {
        return item.text;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parseMetadata(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(rawValue);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return null;
  } catch (error) {
    return null;
  }
}

function inferBedrockImageFormat(mimetype = '', fallbackName = '') {
  const normalizedMime = String(mimetype || '').toLowerCase();
  if (normalizedMime.includes('png')) return 'png';
  if (normalizedMime.includes('jpeg') || normalizedMime.includes('jpg')) return 'jpeg';
  if (normalizedMime.includes('webp')) return 'webp';
  if (normalizedMime.includes('gif')) return 'gif';
  const ext = String(fallbackName || '')
    .split('.')
    .pop()
    .toLowerCase();
  if (['png', 'jpeg', 'jpg', 'webp', 'gif'].includes(ext)) {
    return ext === 'jpg' ? 'jpeg' : ext;
  }
  return 'png';
}

function resolveBedrockModelId(rawValue) {
  const candidate = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!candidate) {
    return null;
  }
  if (candidate.startsWith('us.') || candidate.startsWith('global.')) {
    return candidate;
  }
  if (
    /^(anthropic|meta|amazon|mistral|cohere|ai21|deepseek|writer|stability)\./.test(candidate)
  ) {
    return `us.${candidate}`;
  }
  return candidate;
}

function resolveModelCandidates(brand) {
  const candidates = [
    resolveBedrockModelId(brand.modelId || brand.assistantId || null),
    resolveBedrockModelId(process.env.BEDROCK_MODEL_ID_DEFAULT || null),
    resolveBedrockModelId(process.env.DEFAULT_BRAND_MODEL_ID || null),
    resolveBedrockModelId(SAFE_FALLBACK_MODEL_ID)
  ].filter(Boolean);

  return [...new Set(candidates)];
}

function isModelAccessDenied(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.name || error?.code || '').toLowerCase();
  return (
    message.includes('model access is denied') ||
    message.includes('aws-marketplace') ||
    message.includes('viewsubscriptions') ||
    message.includes('subscribe') ||
    code.includes('accessdenied')
  );
}

function buildConversationMessages(history, imageAttachment) {
  const messages = [];

  history.forEach((record) => {
    const role = record.role === 'assistant' ? 'assistant' : record.role === 'user' ? 'user' : null;
    if (!role) return;

    const content = [];
    if (typeof record.content === 'string' && record.content.trim()) {
      content.push({ text: record.content.trim() });
    }

    if (role === 'user') {
      const metadata = parseMetadata(record.display_metadata);
      const imageBase64 = metadata?.imageBase64;
      if (imageBase64) {
        const format = inferBedrockImageFormat(metadata.imageMimeType, metadata.imageFilename);
        content.push({
          image: {
            format,
            source: {
              bytes: Buffer.from(imageBase64, 'base64')
            }
          }
        });
      }
    }

    if (!content.length) {
      return;
    }

    messages.push({
      role,
      content
    });
  });

  if (imageAttachment?.bytesBase64 && messages.length) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'user') {
      lastMessage.content.push({
        image: {
          format: inferBedrockImageFormat(imageAttachment.mimeType, imageAttachment.filename),
          source: {
            bytes: Buffer.from(imageAttachment.bytesBase64, 'base64')
          }
        }
      });
    }
  }

  return messages;
}

function toInferenceConfig(brand) {
  const settings = brand.assistantSettings || {};
  const config = {};

  if (typeof settings.temperature === 'number' && !Number.isNaN(settings.temperature)) {
    config.temperature = settings.temperature;
  }
  if (typeof settings.topP === 'number' && !Number.isNaN(settings.topP)) {
    config.topP = settings.topP;
  }
  if (typeof settings.maxTokens === 'number' && Number.isInteger(settings.maxTokens) && settings.maxTokens > 0) {
    config.maxTokens = settings.maxTokens;
  }

  return Object.keys(config).length ? config : undefined;
}

async function createThread({ userId, brand, title }) {
  const user = findUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  ensureUserBrandAccess(userId, brand.id);

  return createThreadRecord({
    userId,
    brandId: brand.id,
    openaiThreadId: `bedrock-${uuid()}`,
    title: title || `Conversación ${new Date().toLocaleString('es-MX')}`
  });
}

async function sendMessage({
  userId,
  brand,
  message,
  threadId,
  displayMetadata,
  formatContext,
  communicationProfile,
  imageAttachment
}) {
  const user = findUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  ensureUserBrandAccess(userId, brand.id);

  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  const hasImageAttachment = Boolean(imageAttachment?.bytesBase64);
  if (!trimmedMessage && !hasImageAttachment) {
    throw new Error('Message is required');
  }

  const modelCandidates = resolveModelCandidates(brand);
  if (!modelCandidates.length) {
    throw new Error('No existe modelId configurado para la marca');
  }
  const preferredModelId = modelCandidates[0];

  let targetThread = threadId
    ? ensureThreadOwnership(threadId, userId, brand.id)
    : getLatestThreadForUser(userId, brand.id);
  if (!targetThread) {
    targetThread = await createThread({ userId, brand });
  } else if (targetThread.brand_id !== brand.id) {
    const err = new Error('THREAD_NOT_FOUND');
    err.code = 'THREAD_NOT_FOUND';
    throw err;
  }

  const supplemental = [];
  if (typeof formatContext === 'string' && formatContext.trim()) {
    supplemental.push(formatContext.trim());
  }
  const profileContext = buildCommunicationProfileContext(communicationProfile);
  if (profileContext) {
    supplemental.push(profileContext);
  }

  const payloadMessage = [trimmedMessage, ...supplemental].filter(Boolean).join('\n\n');

  const metadataPayload =
    displayMetadata && typeof displayMetadata === 'object' && !Array.isArray(displayMetadata)
      ? { ...displayMetadata }
      : {};

  if (imageAttachment?.bytesBase64) {
    metadataPayload.imageFilename = imageAttachment.filename || metadataPayload.imageFilename;
    metadataPayload.imageSize = imageAttachment.size || metadataPayload.imageSize;
    metadataPayload.imageMimeType = imageAttachment.mimeType || metadataPayload.imageMimeType;
    metadataPayload.imageBase64 = imageAttachment.bytesBase64;
  }

  saveMessage({
    threadId: targetThread.id,
    brandId: brand.id,
    role: 'user',
    content: payloadMessage || '[Imagen adjunta]',
    openaiMessageId: `usr-${uuid()}`,
    displayMetadata: Object.keys(metadataPayload).length ? metadataPayload : null
  });

  const history = getMessagesByThread(targetThread.id);
  const conversationMessages = buildConversationMessages(history, imageAttachment);
  const retrievalSeed = trimmedMessage || payloadMessage || 'Consulta de conocimiento';

  let knowledgeContext = '';
  try {
    knowledgeContext = await retrieveKnowledgeContext({
      knowledgeBaseId: brand.knowledgeBaseId,
      prompt: retrievalSeed,
      topK: parseInt(process.env.KB_RETRIEVAL_TOP_K || '4', 10)
    });
  } catch (error) {
    console.error('No se pudo recuperar contexto de Knowledge Base', error.message);
  }

  const systemParts = [
    'Eres un asistente especializado para equipos farmacéuticos. Responde en español con precisión clínica y comercial.',
    'Si no tienes evidencia suficiente, indícalo de forma explícita y sugiere el siguiente paso.'
  ];

  if (brand.assistantSettings?.instructions) {
    systemParts.push(brand.assistantSettings.instructions);
  }

  if (knowledgeContext) {
    systemParts.push(`Contexto recuperado de la base de conocimiento:\n${knowledgeContext}`);
  }

  const commandInputBase = {
    system: systemParts.filter(Boolean).map((text) => ({ text })),
    messages: conversationMessages,
    inferenceConfig: toInferenceConfig(brand)
  };

  if (brand.guardrailId) {
    commandInputBase.guardrailConfig = {
      guardrailIdentifier: brand.guardrailId,
      guardrailVersion: process.env.BEDROCK_GUARDRAIL_VERSION || 'DRAFT'
    };
  }

  let response = null;
  let resolvedModelId = null;
  let lastError = null;

  for (const modelId of modelCandidates) {
    try {
      response = await bedrockRuntimeClient.send(
        new ConverseCommand({
          modelId,
          ...commandInputBase
        })
      );
      resolvedModelId = modelId;
      break;
    } catch (error) {
      lastError = error;
      if (isModelAccessDenied(error)) {
        console.warn(`Modelo Bedrock sin acceso (${modelId}). Intentando fallback.`);
        continue;
      }
      throw error;
    }
  }

  if (!response) {
    throw lastError || new Error('No se pudo obtener respuesta del modelo Bedrock');
  }

  if (resolvedModelId && resolvedModelId !== preferredModelId) {
    try {
      updateBrand(brand.id, {
        modelId: resolvedModelId,
        assistantId: resolvedModelId
      });
    } catch (error) {
      console.warn('No se pudo persistir fallback de modelId para la marca', error.message);
    }
  }

  const assistantText = extractAssistantText(response?.output?.message?.content) || 'No encontré respuesta para esta consulta.';

  const savedAssistantMessage = saveMessage({
    threadId: targetThread.id,
    brandId: brand.id,
    role: 'assistant',
    content: assistantText,
    openaiMessageId: `asst-${uuid()}`
  });

  return {
    threadId: targetThread.id,
    messages: getMessagesByThread(targetThread.id),
    lastRunId: response?.ResponseMetadata?.RequestId || null,
    assistantMessages: [savedAssistantMessage]
  };
}

function getThreadMessagesForUser({ threadId, userId, brandId }) {
  if (userId) {
    ensureThreadOwnership(threadId, userId, brandId);
  }
  return getMessagesByThread(threadId);
}

module.exports = {
  sendMessage,
  createThread,
  listThreads: (userId, brandId) => listThreadsForUser(userId, brandId),
  getThreadMessagesForUser,
  renameThread: ({ threadId, userId, brandId, title }) => {
    ensureThreadOwnership(threadId, userId, brandId);
    return renameThread({ threadId, title });
  }
};
