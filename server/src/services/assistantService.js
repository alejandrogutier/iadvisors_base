const {
  saveMessage,
  createThreadRecord,
  getMessagesByThread,
  getThreadById,
  renameThread,
  listThreadsForUser,
  findUserById,
  getLatestThreadForUser,
  ensureUserBrandAccess
} = require('../db');
const { client } = require('../openaiClient');
const { buildCommunicationProfileContext } = require('../data/communicationProfiles');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderTextFromContent(contentBlocks) {
  if (!Array.isArray(contentBlocks)) return '';
  return contentBlocks
    .map((block) => {
      if (block.type === 'text' && block.text) {
        return block.text.value;
      }
      if (block.type === 'output_text' && block.output_text) {
        return block.output_text.map((t) => t.text).join('\n');
      }
      if (block.type === 'message' && block.message) {
        return renderTextFromContent(block.message);
      }
      if (block?.type === 'tool_call' && block?.tool_call?.output) {
        return block.tool_call.output;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

async function waitForRun(threadId, runId) {
  while (true) {
    const run = await client.beta.threads.runs.retrieve(runId, { thread_id: threadId });
    if (
      run.status === 'completed' ||
      run.status === 'failed' ||
      run.status === 'cancelled' ||
      run.status === 'expired'
    ) {
      return run;
    }
    await delay(1500);
  }
}

function ensureThreadOwnership(threadId, userId, brandId) {
  const thread = getThreadById(threadId);
  if (!thread || thread.user_id !== userId || (brandId && thread.brand_id !== brandId)) {
    const err = new Error('THREAD_NOT_FOUND');
    err.code = 'THREAD_NOT_FOUND';
    throw err;
  }
  return thread;
}

async function createThread({ userId, brand, title }) {
  const user = findUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  ensureUserBrandAccess(userId, brand.id);
  const thread = await client.beta.threads.create();
  return createThreadRecord({
    userId,
    brandId: brand.id,
    openaiThreadId: thread.id,
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
  const hasImageAttachment = Boolean(imageAttachment?.fileId);
  if (!trimmedMessage && !hasImageAttachment) {
    throw new Error('Message is required');
  }
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
  const textSections = [trimmedMessage, ...supplemental].filter(Boolean);
  const payloadMessage = textSections.join('\n\n');
  const contentParts = [];
  if (payloadMessage) {
    contentParts.push({ type: 'text', text: payloadMessage });
  }
  if (hasImageAttachment) {
    contentParts.push({
      type: 'image_file',
      image_file: { file_id: imageAttachment.fileId }
    });
  }
  const sentMessage = await client.beta.threads.messages.create(
    targetThread.openai_thread_id,
    {
      role: 'user',
      content: contentParts
    }
  );
  saveMessage({
    threadId: targetThread.id,
    brandId: brand.id,
    role: 'user',
    content: payloadMessage || (hasImageAttachment ? '[Imagen adjunta]' : ''),
    openaiMessageId: sentMessage.id,
    displayMetadata: displayMetadata || null
  });

  const run = await client.beta.threads.runs.create(targetThread.openai_thread_id, {
    assistant_id: brand.assistantId,
    metadata: {
      user_id: userId,
      user_email: user.email
    }
  });

  const finalRun = await waitForRun(targetThread.openai_thread_id, run.id);
  if (finalRun.status !== 'completed') {
    throw new Error(`Run ended with status ${finalRun.status}`);
  }

  const messageList = await client.beta.threads.messages.list(
    targetThread.openai_thread_id,
    { order: 'asc' }
  );

  const assistantMessages = [];
  for (const item of messageList.data) {
    if (item.role !== 'assistant' || item.run_id !== finalRun.id) continue;
    const text = renderTextFromContent(item.content);
    const saved = saveMessage({
      threadId: targetThread.id,
       brandId: brand.id,
      role: 'assistant',
      content: text,
      openaiMessageId: item.id
    });
    assistantMessages.push(saved);
  }

  return {
    threadId: targetThread.id,
    messages: getMessagesByThread(targetThread.id),
    lastRunId: finalRun.id,
    assistantMessages
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
