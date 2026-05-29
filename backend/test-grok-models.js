import 'dotenv/config';
import OpenAI from 'openai';

const providers = {
  groq: {
    label: 'Groq',
    apiKeyEnv: 'GROQ_API_KEY',
    modelEnv: 'GROQ_MODEL',
    defaultModel: 'llama-3.3-70b-versatile',
    fallbackModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    baseURL: process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1',
    keyUrl: 'https://console.groq.com/keys',
  },
  xai: {
    label: 'xAI',
    apiKeyEnv: 'GROK_API_KEY',
    modelEnv: 'GROK_MODEL',
    defaultModel: 'grok-4.3',
    fallbackModels: ['grok-4.3', 'grok-4.20', 'grok-3-mini'],
    baseURL: process.env.GROK_API_URL || 'https://api.x.ai/v1',
    keyUrl: 'https://console.x.ai/',
  },
};

const providerName = (process.env.LLM_PROVIDER || 'groq').toLowerCase();
const provider = providers[providerName] || providers.groq;
const apiKey = process.env[provider.apiKeyEnv];

if (!apiKey) {
  console.error(`ERROR: ${provider.apiKeyEnv} is not set in .env file`);
  process.exit(1);
}

const client = new OpenAI({
  apiKey,
  baseURL: provider.baseURL,
});

console.log(`Testing ${provider.label} API with baseURL: ${provider.baseURL}\n`);
console.log('Testing available models...\n');

const modelsToTest = [...new Set([
  process.env[provider.modelEnv] || provider.defaultModel,
  ...provider.fallbackModels,
])];

let foundWorkingModel = false;

for (const model of modelsToTest) {
  try {
    console.log(`Testing model: ${model}...`);
    const response = await client.chat.completions.create({
      model: model,
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'Hello',
        },
      ],
    });
    console.log(`✓ SUCCESS! Model "${model}" is available!\n`);
    console.log(`Response:`, response.choices[0].message.content);
    console.log('\n---\n');
    foundWorkingModel = true;
    break; // Stop after first success
  } catch (error) {
    const message = error.message || String(error);
    if (error.status === 401 || message.toLowerCase().includes('incorrect api key')) {
      console.log(`✗ Authentication error: ${provider.apiKeyEnv} is invalid or expired.`);
      console.log(`Please create a valid ${provider.label} API key at ${provider.keyUrl} and update backend/.env.\n`);
      process.exit(1);
    } else if (providerName === 'xai' && error.status === 403 && (message.toLowerCase().includes('credits') || message.toLowerCase().includes('licenses'))) {
      console.log('✗ Access error: this xAI team has no credits or licenses yet.');
      console.log('Add credits or a license in the xAI Console, then run this test again.\n');
      process.exit(1);
    } else if (error.status === 400 && message.includes('Model not found')) {
      console.log(`✗ Model not found: ${model}\n`);
    } else {
      console.log(`✗ Error: ${message}\n`);
    }
  }
}

if (!foundWorkingModel) {
  console.log('\nNo working model was found for this API key/account.');
  process.exit(1);
}

console.log('\n✓ Test complete!');
