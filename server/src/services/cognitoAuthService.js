const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AdminSetUserPasswordCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const cognitoRegion = process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1';
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID;

const cognitoClient = new CognitoIdentityProviderClient({ region: cognitoRegion });

function isCognitoConfigured() {
  return Boolean(userPoolId && clientId);
}

function ensureCognitoConfigured() {
  if (!isCognitoConfigured()) {
    const error = new Error('COGNITO_NOT_CONFIGURED');
    error.code = 'COGNITO_NOT_CONFIGURED';
    throw error;
  }
}

function decodeJwtPayload(token = '') {
  try {
    const payload = token.split('.')[1];
    if (!payload) return {};
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4 || 4)) % 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (error) {
    return {};
  }
}

function deriveRoleFromGroups(groups = []) {
  const normalized = groups.map((group) => String(group || '').toLowerCase());
  if (normalized.includes('admin')) {
    return 'admin';
  }
  if (normalized.includes('analyst') || normalized.includes('analista')) {
    return 'analyst';
  }
  return 'user';
}

function normalizeAuthError(error) {
  if (!error?.name) return error;
  if (['NotAuthorizedException', 'UserNotFoundException'].includes(error.name)) {
    const wrapped = new Error('INVALID_CREDENTIALS');
    wrapped.code = 'INVALID_CREDENTIALS';
    return wrapped;
  }
  if (error.name === 'PasswordResetRequiredException') {
    const wrapped = new Error('PASSWORD_RESET_REQUIRED');
    wrapped.code = 'PASSWORD_RESET_REQUIRED';
    return wrapped;
  }
  if (error.name === 'UserNotConfirmedException') {
    const wrapped = new Error('USER_NOT_CONFIRMED');
    wrapped.code = 'USER_NOT_CONFIRMED';
    return wrapped;
  }
  return error;
}

async function authenticateWithCognito({ email, password }) {
  ensureCognitoConfigured();

  try {
    const response = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      })
    );

    if (response.ChallengeName) {
      const challengeError = new Error('AUTH_CHALLENGE_REQUIRED');
      challengeError.code = 'AUTH_CHALLENGE_REQUIRED';
      challengeError.challenge = response.ChallengeName;
      throw challengeError;
    }

    const idToken = response.AuthenticationResult?.IdToken;
    const payload = decodeJwtPayload(idToken);
    const groups = Array.isArray(payload['cognito:groups']) ? payload['cognito:groups'] : [];

    return {
      email: String(payload.email || email || '').trim().toLowerCase(),
      name: String(payload.name || payload['cognito:username'] || email || '').trim(),
      groups,
      role: deriveRoleFromGroups(groups),
      sub: payload.sub || null
    };
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

async function changePasswordWithCognito({ email, currentPassword, newPassword }) {
  ensureCognitoConfigured();

  // Valida la contraseña actual autenticando primero contra Cognito.
  await authenticateWithCognito({ email, password: currentPassword });

  try {
    await cognitoClient.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: email,
        Password: newPassword,
        Permanent: true
      })
    );
  } catch (error) {
    if (error?.name === 'InvalidPasswordException') {
      const wrapped = new Error('INVALID_NEW_PASSWORD');
      wrapped.code = 'INVALID_NEW_PASSWORD';
      throw wrapped;
    }
    throw error;
  }
}

module.exports = {
  isCognitoConfigured,
  cognitoRegion,
  authenticateWithCognito,
  changePasswordWithCognito
};
