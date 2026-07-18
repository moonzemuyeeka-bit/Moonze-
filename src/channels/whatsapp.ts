import { Router } from 'express';
import { AppConfig } from '../config';
import { Assistant } from '../ai/assistant';

/**
 * WhatsApp Cloud API (Meta) integration.
 *  - GET  /webhook/whatsapp  -> verification handshake
 *  - POST /webhook/whatsapp  -> inbound messages
 *
 * Outbound sending uses the Graph API when credentials are set; otherwise it
 * logs the reply so the flow is fully testable without a live WhatsApp number.
 */
export function whatsappRouter(config: AppConfig, assistant: Assistant): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  router.post('/', async (req, res) => {
    // Acknowledge fast so Meta doesn't retry.
    res.sendStatus(200);
    try {
      const messages = extractMessages(req.body);
      for (const msg of messages) {
        const reply = await assistant.handle({
          sessionId: msg.from,
          text: msg.text,
          customerPhone: msg.from,
          customerName: msg.name,
        });
        await sendWhatsAppMessage(config, msg.from, reply.text);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('WhatsApp webhook error:', err);
    }
  });

  return router;
}

interface InboundMessage {
  from: string;
  text: string;
  name?: string;
}

export function extractMessages(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const b = body as any;
  const entries = b?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const contacts = value?.contacts ?? [];
      const nameByWa: Record<string, string> = {};
      for (const c of contacts) {
        if (c?.wa_id) nameByWa[c.wa_id] = c?.profile?.name;
      }
      for (const m of value?.messages ?? []) {
        const text = m?.text?.body ?? m?.button?.text ?? m?.interactive?.list_reply?.title ?? '';
        if (m?.from && text) {
          out.push({ from: m.from, text, name: nameByWa[m.from] });
        }
      }
    }
  }
  return out;
}

export async function sendWhatsAppMessage(config: AppConfig, to: string, text: string): Promise<void> {
  if (!config.whatsapp.accessToken || !config.whatsapp.phoneNumberId) {
    // eslint-disable-next-line no-console
    console.log(`[whatsapp:log] -> ${to}: ${text}`);
    return;
  }
  const url = `https://graph.facebook.com/v20.0/${config.whatsapp.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.whatsapp.accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });
  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error('WhatsApp send failed:', res.status, await res.text().catch(() => ''));
  }
}
