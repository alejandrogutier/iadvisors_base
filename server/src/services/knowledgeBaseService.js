const {
  CreateKnowledgeBaseCommand,
  CreateDataSourceCommand,
  StartIngestionJobCommand
} = require('@aws-sdk/client-bedrock-agent');
const { RetrieveCommand } = require('@aws-sdk/client-bedrock-agent-runtime');
const { v4: uuid } = require('uuid');
const { bedrockAgentClient } = require('../aws/bedrockAgentClient');
const { bedrockAgentRuntimeClient } = require('../aws/bedrockAgentRuntimeClient');
const { bedrockRegion } = require('../aws/bedrockRuntimeClient');

const defaultEmbeddingModelArn =
  process.env.BEDROCK_EMBEDDING_MODEL_ARN ||
  `arn:aws:bedrock:${bedrockRegion}::foundation-model/amazon.titan-embed-text-v2:0`;

function resolveKbBucket() {
  return process.env.KB_BUCKET || process.env.UPLOADS_BUCKET || '';
}

function resolveKbS3Prefix(brandId = '', providedPrefix = '') {
  if (typeof providedPrefix === 'string' && providedPrefix.trim()) {
    return providedPrefix.trim().replace(/^\/+/, '').replace(/\/+$/, '') + '/';
  }
  const safeBrandId = String(brandId || 'default').trim().replace(/[^a-zA-Z0-9/_-]/g, '-');
  return `kb/${safeBrandId}/`;
}

function inferKnowledgeBaseStatus(knowledgeBaseId) {
  if (!knowledgeBaseId) return 'NOT_CONFIGURED';
  return 'ACTIVE';
}

function canProvisionKnowledgeBase() {
  return Boolean(
    process.env.BEDROCK_KB_ROLE_ARN &&
      process.env.BEDROCK_KB_COLLECTION_ARN &&
      resolveKbBucket()
  );
}

async function provisionBrandKnowledgeBase({
  brandId,
  brandName,
  modelId,
  existingKnowledgeBaseId,
  existingDataSourceId,
  kbS3Prefix
}) {
  const bucket = resolveKbBucket();
  const resolvedPrefix = resolveKbS3Prefix(brandId, kbS3Prefix);
  const resolvedModel = modelId || process.env.BEDROCK_MODEL_ID_DEFAULT || '';

  if (!canProvisionKnowledgeBase()) {
    return {
      modelId: resolvedModel,
      knowledgeBaseId: existingKnowledgeBaseId || null,
      kbDataSourceId: existingDataSourceId || null,
      kbS3Prefix: resolvedPrefix,
      knowledgeBaseStatus: existingKnowledgeBaseId ? inferKnowledgeBaseStatus(existingKnowledgeBaseId) : 'PENDING_CONFIG'
    };
  }

  if (existingKnowledgeBaseId && existingDataSourceId) {
    return {
      modelId: resolvedModel,
      knowledgeBaseId: existingKnowledgeBaseId,
      kbDataSourceId: existingDataSourceId,
      kbS3Prefix: resolvedPrefix,
      knowledgeBaseStatus: inferKnowledgeBaseStatus(existingKnowledgeBaseId)
    };
  }

  const knowledgeBaseName = `iadvisors-${String(brandId || 'brand').toLowerCase()}`.replace(/[^a-z0-9-]/g, '-').slice(0, 100);
  const dataSourceName = `${knowledgeBaseName}-source`.slice(0, 100);

  const kbResponse = await bedrockAgentClient.send(
    new CreateKnowledgeBaseCommand({
      name: knowledgeBaseName,
      roleArn: process.env.BEDROCK_KB_ROLE_ARN,
      description: `Knowledge base para marca ${brandName || brandId}`,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: defaultEmbeddingModelArn
        }
      },
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: process.env.BEDROCK_KB_COLLECTION_ARN,
          vectorIndexName: process.env.BEDROCK_KB_VECTOR_INDEX_NAME || 'iadvisors-index',
          fieldMapping: {
            vectorField: process.env.BEDROCK_KB_VECTOR_FIELD || 'vector',
            textField: process.env.BEDROCK_KB_TEXT_FIELD || 'text',
            metadataField: process.env.BEDROCK_KB_METADATA_FIELD || 'metadata'
          }
        }
      },
      clientToken: uuid()
    })
  );

  const knowledgeBaseId = kbResponse?.knowledgeBase?.knowledgeBaseId;
  const knowledgeBaseStatus = kbResponse?.knowledgeBase?.status || inferKnowledgeBaseStatus(knowledgeBaseId);

  if (!knowledgeBaseId) {
    throw new Error('No se pudo crear la knowledge base para la marca');
  }

  const dsResponse = await bedrockAgentClient.send(
    new CreateDataSourceCommand({
      knowledgeBaseId,
      name: dataSourceName,
      description: `Data source S3 para ${brandName || brandId}`,
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: `arn:aws:s3:::${bucket}`,
          inclusionPrefixes: [resolvedPrefix]
        }
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: 'FIXED_SIZE',
          fixedSizeChunkingConfiguration: {
            maxTokens: parseInt(process.env.KB_CHUNK_MAX_TOKENS || '300', 10),
            overlapPercentage: parseInt(process.env.KB_CHUNK_OVERLAP_PERCENT || '20', 10)
          }
        }
      },
      clientToken: uuid()
    })
  );

  const kbDataSourceId = dsResponse?.dataSource?.dataSourceId;
  if (!kbDataSourceId) {
    throw new Error('No se pudo crear el data source de la knowledge base');
  }

  return {
    modelId: resolvedModel,
    knowledgeBaseId,
    kbDataSourceId,
    kbS3Prefix: resolvedPrefix,
    knowledgeBaseStatus
  };
}

async function startKnowledgeBaseIngestionJob({ knowledgeBaseId, dataSourceId }) {
  if (!knowledgeBaseId || !dataSourceId) {
    return null;
  }
  const response = await bedrockAgentClient.send(
    new StartIngestionJobCommand({
      knowledgeBaseId,
      dataSourceId,
      clientToken: uuid()
    })
  );
  return response?.ingestionJob || null;
}

function extractRetrievalText(result) {
  const text = result?.content?.text;
  if (typeof text === 'string' && text.trim()) {
    return text.trim();
  }
  return '';
}

async function retrieveKnowledgeContext({ knowledgeBaseId, prompt, topK = 4 }) {
  if (!knowledgeBaseId || !prompt || process.env.RAG_ENABLED === 'false') {
    return '';
  }
  const response = await bedrockAgentRuntimeClient.send(
    new RetrieveCommand({
      knowledgeBaseId,
      retrievalQuery: {
        text: prompt
      },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: topK
        }
      }
    })
  );
  const retrievalResults = Array.isArray(response?.retrievalResults) ? response.retrievalResults : [];
  const fragments = retrievalResults
    .map(extractRetrievalText)
    .filter(Boolean);

  if (!fragments.length) {
    return '';
  }

  return fragments.join('\n\n---\n\n');
}

module.exports = {
  resolveKbBucket,
  resolveKbS3Prefix,
  inferKnowledgeBaseStatus,
  canProvisionKnowledgeBase,
  provisionBrandKnowledgeBase,
  startKnowledgeBaseIngestionJob,
  retrieveKnowledgeContext
};
