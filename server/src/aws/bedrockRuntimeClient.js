const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');

const bedrockRegion = process.env.BEDROCK_REGION || process.env.AWS_REGION || process.env.COGNITO_REGION || 'us-east-1';

const bedrockRuntimeClient = new BedrockRuntimeClient({
  region: bedrockRegion
});

module.exports = {
  bedrockRuntimeClient,
  bedrockRegion
};
