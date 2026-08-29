import { registerAs } from '@nestjs/config';

/**
 * Enterprise GitHub App Configuration
 */
export default registerAs('github', () => ({
  appId: process.env.GITHUB_APP_ID,
  clientId: process.env.GITHUB_APP_CLIENT_ID,
  clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
  installationId: process.env.GITHUB_APP_INSTALLATION_ID
    ? parseInt(process.env.GITHUB_APP_INSTALLATION_ID, 10)
    : undefined,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
}));
