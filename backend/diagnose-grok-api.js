import 'dotenv/config';
import OpenAI from 'openai';

const provider = (process.env.LLM_PROVIDER || 'groq').toLowerCase();
const isGroq = provider !== 'xai';
const apiKeyEnv = isGroq ? 'GROQ_API_KEY' : 'GROK_API_KEY';
const model = isGroq
  ? process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  : process.env.GROK_MODEL || 'grok-4.3';
const apiKey = process.env[apiKeyEnv];
const baseURL = isGroq
  ? process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1'
  : process.env.GROK_API_URL || 'https://api.x.ai/v1';

console.log('=== LLM API Diagnostics ===\n');
console.log(`Provider: ${isGroq ? 'Groq' : 'xAI'}`);
console.log(`BaseURL: ${baseURL}`);
console.log(`Model: ${model}`);
console.log(`API Key: ${apiKey ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}` : 'NOT SET'}\n`);

if (!apiKey) {
  console.error(`ERROR: ${apiKeyEnv} is not set!`);
  process.exit(1);
}

const client = new OpenAI({
  apiKey,
  baseURL,
});

console.log('Testing API connectivity...\n');

try {
  const response = await client.chat.completions.create({
    model,
    max_tokens: 5,
    messages: [
      {
        role: 'user',
        content: 'test',
      },
    ],
  });

  console.log('Response:', response.choices[0].message.content);
} catch (error) {
  const message = error.message || String(error);
  console.log(`Error Status: ${error.status}`);
  console.log(`Error Type: ${error.type}`);
  console.log(`Error Message: ${message}`);

  if (error.status === 401 || message.toLowerCase().includes('incorrect api key')) {
    console.log('\nISSUE: Authentication failed.');
    console.log(`- Create a valid API key at ${isGroq ? 'https://console.groq.com/keys' : 'https://console.x.ai/'}.`);
    console.log(`- Set it as ${apiKeyEnv} in backend/.env.`);
  } else if (error.status === 400 && message.includes('Model not found')) {
    console.log('\nISSUE: The configured model is not available.');
    console.log(`- Check that ${model} is enabled for your account.`);
    console.log(`- Try setting ${isGroq ? 'GROQ_MODEL=llama-3.1-8b-instant' : 'GROK_MODEL=grok-4.3'}.`);
  } else {
    console.log('\nISSUE: Connection or provider error.');
    console.log('- Check your internet connection and provider account status.');
  }
}
