const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AdminSetUserPasswordCommand,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminDeleteUserCommand,
  AdminListGroupsForUserCommand
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

function normalizeAdminError(error) {
  if (!error?.name) return error;
  if (error.name === 'UsernameExistsException') {
    const wrapped = new Error('COGNITO_USER_EXISTS');
    wrapped.code = 'COGNITO_USER_EXISTS';
    return wrapped;
  }
  if (error.name === 'InvalidPasswordException') {
    const wrapped = new Error('INVALID_NEW_PASSWORD');
    wrapped.code = 'INVALID_NEW_PASSWORD';
    return wrapped;
  }
  if (error.name === 'UserNotFoundException') {
    const wrapped = new Error('COGNITO_USER_NOT_FOUND');
    wrapped.code = 'COGNITO_USER_NOT_FOUND';
    return wrapped;
  }
  return error;
}

function normalizeRole(role) {
  if (role === 'admin') return 'admin';
  if (role === 'analyst') return 'analyst';
  return 'user';
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
    throw normalizeAdminError(error);
  }
}

async function listUserGroups(email) {
  const response = await cognitoClient.send(
    new AdminListGroupsForUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      Limit: 50
    })
  );
  return Array.isArray(response?.Groups) ? response.Groups.map((item) => item.GroupName).filter(Boolean) : [];
}

async function updateUserRoleInCognito({ email, role }) {
  ensureCognitoConfigured();
  const normalizedRole = normalizeRole(role);

  try {
    const currentGroups = await listUserGroups(email);
    const managedGroups = ['admin', 'analyst'];

    for (const groupName of managedGroups) {
      if (currentGroups.includes(groupName) && groupName !== normalizedRole) {
        // eslint-disable-next-line no-await-in-loop
        await cognitoClient.send(
          new AdminRemoveUserFromGroupCommand({
            UserPoolId: userPoolId,
            Username: email,
            GroupName: groupName
          })
        );
      }
    }

    if (normalizedRole === 'admin' || normalizedRole === 'analyst') {
      if (!currentGroups.includes(normalizedRole)) {
        await cognitoClient.send(
          new AdminAddUserToGroupCommand({
            UserPoolId: userPoolId,
            Username: email,
            GroupName: normalizedRole
          })
        );
      }
    }
  } catch (error) {
    throw normalizeAdminError(error);
  }
}

async function createUserInCognito({ email, name, password, role }) {
  ensureCognitoConfigured();
  try {
    await cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          ...(name ? [{ Name: 'name', Value: name }] : [])
        ]
      })
    );

    await cognitoClient.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: email,
        Password: password,
        Permanent: true
      })
    );

    await updateUserRoleInCognito({ email, role });
  } catch (error) {
    throw normalizeAdminError(error);
  }
}

async function deleteUserInCognito({ email }) {
  ensureCognitoConfigured();
  try {
    await cognitoClient.send(
      new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: email
      })
    );
  } catch (error) {
    const normalized = normalizeAdminError(error);
    if (normalized.code === 'COGNITO_USER_NOT_FOUND') {
      return;
    }
    throw normalized;
  }
}

module.exports = {
  isCognitoConfigured,
  cognitoRegion,
  authenticateWithCognito,
  changePasswordWithCognito,
  createUserInCognito,
  updateUserRoleInCognito,
  deleteUserInCognito
};
