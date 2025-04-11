import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  AWS_REGION: Joi.string().required(),
  AWS_ACCESS_ID: Joi.string().required(),
  AWS_SECRET_KEY: Joi.string().required(),
  GOOGLE_OAUTH_URL: Joi.string().required(),
  GOOGLE_REDIRECT_URL: Joi.string().required(),
  GOOGLE_API_URL: Joi.string().required(),
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  INSTAGRAM_OAUTH_URL: Joi.string().required(),
  INSTAGRAM_REDIRECT_URL: Joi.string().required(),
  INSTAGRAM_BASE_URL: Joi.string().required(),
  INSTAGRAM_CLIENT_ID: Joi.string().required(),
  INSTAGRAM_CLIENT_SECRET: Joi.string().required(),
  GPT_KEY:Joi.string().required()
});
