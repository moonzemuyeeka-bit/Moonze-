import request from 'supertest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { extractMessages } from '../src/channels/whatsapp';

const app = createApp(loadConfig({ PORT: '0' } as NodeJS.ProcessEnv));

describe('HTTP API', () => {
  it('reports health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('serves salon and service catalogs', async () => {
    const salons = await request(app).get('/api/salons');
    expect(salons.status).toBe(200);
    expect(Array.isArray(salons.body)).toBe(true);
    const services = await request(app).get('/api/services');
    expect(services.body.length).toBeGreaterThan(0);
  });

  it('handles a web chat message', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ sessionId: 'api1', message: 'knotless braids near me' });
    expect(res.status).toBe(200);
    expect(res.body.text).toMatch(/Knotless/);
    expect(res.body.cards.some((c: any) => c.type === 'salon')).toBe(true);
  });

  it('validates web chat input', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'hi' });
    expect(res.status).toBe(400);
  });

  it('verifies WhatsApp webhook handshake', async () => {
    const res = await request(app)
      .get('/webhook/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'moonze-verify-token', 'hub.challenge': '12345' });
    expect(res.status).toBe(200);
    expect(res.text).toBe('12345');
  });

  it('rejects WhatsApp webhook with bad token', async () => {
    const res = await request(app)
      .get('/webhook/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'x' });
    expect(res.status).toBe(403);
  });

  it('accepts inbound WhatsApp messages', async () => {
    const res = await request(app)
      .post('/webhook/whatsapp')
      .send({ entry: [{ changes: [{ value: { messages: [{ from: '254700', text: { body: 'hi' } }] } }] }] });
    expect(res.status).toBe(200);
  });
});

describe('WhatsApp payload parsing', () => {
  it('extracts message text and contact name', () => {
    const msgs = extractMessages({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: '254700', profile: { name: 'Aisha' } }],
                messages: [{ from: '254700', text: { body: 'box braids' } }],
              },
            },
          ],
        },
      ],
    });
    expect(msgs).toEqual([{ from: '254700', text: 'box braids', name: 'Aisha' }]);
  });
});
