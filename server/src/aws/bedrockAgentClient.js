const { BedrockAgentClient } = require('@aws-sdk/client-bedrock-agent');
const { bedrockRegion } = require('./bedrockRuntimeClient');

const bedrockAgentClient = new BedrockAgentClient({
  region: bedrockRegion
});

module.exports = {
  bedrockAgentClient
};
