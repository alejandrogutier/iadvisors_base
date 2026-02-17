const { BedrockAgentRuntimeClient } = require('@aws-sdk/client-bedrock-agent-runtime');
const { bedrockRegion } = require('./bedrockRuntimeClient');

const bedrockAgentRuntimeClient = new BedrockAgentRuntimeClient({
  region: bedrockRegion
});

module.exports = {
  bedrockAgentRuntimeClient
};
