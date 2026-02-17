const OpenAI = require('openai');

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY env variable is required');
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

module.exports = {
  client
};
