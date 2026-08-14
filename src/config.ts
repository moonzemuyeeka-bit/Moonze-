export interface AppConfig {
  port: number;
  openAiApiKey: string;
  openAiModel: string;
  whatsapp: {
    verifyToken: string;
    accessToken: string;
    phoneNumberId: string;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT) || 3000,
    openAiApiKey: env.OPENAI_API_KEY || '',
    openAiModel: env.OPENAI_MODEL || 'gpt-4o-mini',
    whatsapp: {
      verifyToken: env.WHATSAPP_VERIFY_TOKEN || 'flawless-verify-token',
      accessToken: env.WHATSAPP_ACCESS_TOKEN || '',
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
    },
  };
}
