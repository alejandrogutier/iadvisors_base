const { S3Client } = require('@aws-sdk/client-s3');

const s3Region = process.env.S3_REGION || process.env.AWS_REGION || process.env.BEDROCK_REGION || process.env.COGNITO_REGION || 'us-east-1';

const s3Client = new S3Client({
  region: s3Region
});

module.exports = {
  s3Client,
  s3Region
};
