import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Flawless assistant running on http://localhost:${config.port}`);
  // eslint-disable-next-line no-console
  console.log(`OpenAI: ${config.openAiApiKey ? 'enabled' : 'disabled (rule-based mode)'}`);
  // eslint-disable-next-line no-console
  console.log(`Demo widget: http://localhost:${config.port}/demo.html`);
});
