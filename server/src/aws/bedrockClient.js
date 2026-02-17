const { BedrockClient } = require('@aws-sdk/client-bedrock');
const { bedrockRegion } = require('./bedrockRuntimeClient');

const bedrockClient = new BedrockClient({
  region: bedrockRegion
});

module.exports = {
  bedrockClient
};
