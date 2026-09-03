import * as Joi from 'joi';

/**
 * Environment Variable Validation using Joi
 */
export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  MONGODB_URI: Joi.string().required(),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Mail
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().required(),
  SMTP_PASS: Joi.string().required(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),

  // GitHub App Configuration
  GITHUB_APP_ID: Joi.string().required(),
  GITHUB_APP_CLIENT_ID: Joi.string().optional().allow(''),
  GITHUB_APP_CLIENT_SECRET: Joi.string().optional().allow(''),
  GITHUB_APP_INSTALLATION_ID: Joi.string().optional().allow(''),
  GITHUB_APP_PRIVATE_KEY: Joi.string().required(),

  // Gemini / AI Configuration
  GEMINI_API_KEY: Joi.string().required(),
});
