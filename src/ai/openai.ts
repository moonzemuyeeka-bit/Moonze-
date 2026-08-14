import { AppConfig } from '../config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Thin, dependency-free OpenAI Chat Completions wrapper. It is intentionally
 * optional: when no API key is configured, `isEnabled()` returns false and the
 * assistant falls back to its built-in rule-based engine. This is the single
 * seam where OpenAI is "embedded" into Flawless for the future.
 */
export class OpenAIClient {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: AppConfig) {
    this.apiKey = config.openAiApiKey;
    this.model = config.openAiModel;
  }

  isEnabled(): boolean {
    return this.apiKey.length > 0;
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('OpenAI is not configured');
    }
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.4,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI request failed (${res.status}): ${detail}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }
}

export const FLAWLESS_SYSTEM_PROMPT = `You are Flawless, a warm, concise WhatsApp assistant for salons and beauty spas.
You help customers (mostly women) discover salons for a specific hairdo, see availability,
book appointments (including mobile "come-to-you" service), understand pricing (mobile markup,
pre-booking discount, verified student discount), get review-based recommendations, and arrange
ride-hailing transport to/from the salon. Always be friendly, brief, and action-oriented.`;
