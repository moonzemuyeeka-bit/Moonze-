import { Router } from 'express';
import { Assistant } from '../ai/assistant';

/**
 * REST endpoint powering the embeddable web chat widget and any custom site
 * integration: POST /api/chat { sessionId, message, location?, name?, phone? }.
 */
export function webchatRouter(assistant: Assistant): Router {
  const router = Router();

  router.post('/chat', async (req, res) => {
    const { sessionId, message, location, name, phone } = req.body ?? {};
    if (!sessionId || typeof message !== 'string') {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }
    try {
      const reply = await assistant.handle({
        sessionId,
        text: message,
        location: isGeo(location) ? location : undefined,
        customerName: typeof name === 'string' ? name : undefined,
        customerPhone: typeof phone === 'string' ? phone : undefined,
      });
      return res.json(reply);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('webchat error:', err);
      return res.status(500).json({ error: 'assistant_error' });
    }
  });

  router.post('/reset', (req, res) => {
    const { sessionId } = req.body ?? {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    assistant.reset(sessionId);
    return res.json({ ok: true });
  });

  return router;
}

function isGeo(v: unknown): v is { lat: number; lng: number } {
  return !!v && typeof (v as any).lat === 'number' && typeof (v as any).lng === 'number';
}
