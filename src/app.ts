import express, { Express } from 'express';
import path from 'path';
import { Assistant } from './ai/assistant';
import { AppConfig } from './config';
import { whatsappRouter } from './channels/whatsapp';
import { webchatRouter } from './channels/webchat';
import { SALONS, SERVICES } from './data/seed';

export function createApp(config: AppConfig): Express {
  const app = express();
  const assistant = new Assistant(config);

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', openai: config.openAiApiKey ? 'enabled' : 'disabled' });
  });

  // Directory / catalog endpoints (useful for websites embedding Moonze).
  app.get('/api/salons', (_req, res) => res.json(SALONS));
  app.get('/api/services', (_req, res) => res.json(SERVICES));

  app.use('/api', webchatRouter(assistant));
  app.use('/webhook/whatsapp', whatsappRouter(config, assistant));

  // Serve the embeddable widget + demo page.
  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}
