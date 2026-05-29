import OpenAI from 'openai';

/**
 * Service to interface with OpenAI-compatible LLM providers.
 * Strictly enforces grounded, zero-hallucination contextual question-answering.
 */
export class GrokService {
  static PROVIDERS = {
    groq: {
      label: 'Groq',
      apiKeyEnv: 'GROQ_API_KEY',
      modelEnv: 'GROQ_MODEL',
      urlEnv: 'GROQ_API_URL',
      defaultModel: 'llama-3.3-70b-versatile',
      defaultBaseURL: 'https://api.groq.com/openai/v1',
      keyUrl: 'https://console.groq.com/keys',
    },
    xai: {
      label: 'xAI',
      apiKeyEnv: 'GROK_API_KEY',
      modelEnv: 'GROK_MODEL',
      urlEnv: 'GROK_API_URL',
      defaultModel: 'grok-4.3',
      defaultBaseURL: 'https://api.x.ai/v1',
      keyUrl: 'https://console.x.ai/',
    },
  };

  static getProviderConfig() {
    const providerName = (process.env.LLM_PROVIDER || 'groq').toLowerCase();
    const provider = this.PROVIDERS[providerName] || this.PROVIDERS.groq;

    return {
      name: providerName,
      ...provider,
      apiKey: process.env[provider.apiKeyEnv],
      model: process.env[provider.modelEnv] || provider.defaultModel,
      baseURL: process.env[provider.urlEnv] || provider.defaultBaseURL,
    };
  }

  static normalizeApiError(error, config) {
    const message = error?.message || String(error);
    const lowerMessage = message.toLowerCase();

    if (error?.status === 401 || lowerMessage.includes('incorrect api key') || lowerMessage.includes('invalid api key')) {
      return `${config.label} API authentication failed. Please set ${config.apiKeyEnv} in backend/.env to a valid key from ${config.keyUrl}.`;
    }

    if (config.name === 'xai' && error?.status === 403 && (lowerMessage.includes('credits') || lowerMessage.includes('licenses'))) {
      return 'xAI API access is blocked because this xAI team has no credits or licenses yet. Add credits or a license in the xAI Console, then retry.';
    }

    if (lowerMessage.includes('model not found')) {
      return `${config.label} model "${config.model}" was not found. Set ${config.modelEnv} in backend/.env to a model available to your account, such as ${config.defaultModel}.`;
    }

    return message;
  }

  /**
   * Instantiates an OpenAI-compatible client.
   * Configured with temperature=0.0 for highly deterministic answers.
   */
  static getGrokClient() {
    const config = this.getProviderConfig();

    if (!config.apiKey) {
      throw new Error(`${config.apiKeyEnv} is not defined in backend environment variables.`);
    }

    console.log(`[LLM CLIENT] Initializing ${config.label} client with baseURL: ${config.baseURL}`);

    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  /**
   * Evaluates user query strictly based on retrieved context.
   * @param {string} question - User question
   * @param {Array<{text: string}>} retrievedChunks - Related vector chunks
   * @returns {Promise<string>} Clean, grounded answer or the negative fallback.
   */
  static async generateAnswer(question, retrievedChunks, conversationHistory = []) {
    if (!question) {
      throw new Error('User question is required.');
    }

    // Format context block from Pinecone chunks
    const retrievedContext = retrievedChunks && retrievedChunks.length > 0
      ? retrievedChunks.map((chunk, index) => {
          const source = chunk.source || 'Unknown file';
          const location = chunk.pageNumber ? `page ${chunk.pageNumber}` : `chunk ${chunk.chunkIndex + 1}`;
          return `[Source ${index + 1}: ${source}, ${location}]\n${chunk.text}`;
        }).join('\n\n')
      : 'No relevant document context found.';

    const historyText = this.buildConversationHistory(conversationHistory);
    const fallback = 'Answer not found in the uploaded documents.';
    const systemPrompt = `You are a domain-specific Multi-Document Legal RAG Assistant. Answer legal questions ONLY with facts present in the supplied uploaded-document context. You may use conversation history only to understand follow-up questions, never as an independent factual source. If the answer is not directly supported by the uploaded-document context, reply exactly: "${fallback}" Include concise source citations in the answer when support exists, using filenames from the context.`;

    const userMessage = `Conversation History:
${historyText}

Uploaded Document Context:
${retrievedContext}

Question:
${question}

Answer:`;

    try {
      const config = this.getProviderConfig();
      const llmClient = this.getGrokClient();
      
      console.log(`[LLM API] Client type: ${typeof llmClient}`);
      console.log(`[LLM API] Client has chat: ${llmClient.chat ? 'YES' : 'NO'}`);
      console.log(`[LLM API] Invoking ${config.label} API for question: "${question}"...`);
      
      const response = await llmClient.chat.completions.create({
        model: config.model,
        max_tokens: 1024,
        temperature: 0.0,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      let finalAnswer = response.choices[0].message.content.trim();

      // Normalize the grounding fallback if the model adds extra text around it.
      if (finalAnswer.toLowerCase().includes('answer not found in the uploaded document')) {
        finalAnswer = fallback;
      }

      console.log(`[LLM API] Response received from ${config.model}: ${finalAnswer.substring(0, 100)}...`);
      return finalAnswer;
    } catch (error) {
      console.error('[LLM API ERROR]:', error);
      const config = this.getProviderConfig();
      throw new Error(`Failed to generate answer from LLM: ${this.normalizeApiError(error, config)}`);
    }
  }

  static buildConversationHistory(history) {
    if (!history) {
      return 'None';
    }

    if (typeof history === 'string') {
      return history.trim() || 'None';
    }

    if (!Array.isArray(history) || history.length === 0) {
      return 'None';
    }

    return history
      .slice(-8)
      .map((item) => `${item.sender === 'user' ? 'User' : 'Assistant'}: ${item.text}`)
      .join('\n');
  }
}
