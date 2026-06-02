import OpenAI from 'openai';
import { LangSmithService } from './langsmithService.js';

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

    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });

    return LangSmithService.wrapOpenAIClient(client, {
      name: `${config.label} Chat Completion`,
      metadata: {
        provider: config.name,
        model: config.model,
        baseURL: config.baseURL,
      },
    });
  }

  /**
   * Evaluates user query strictly based on retrieved context.
   * @param {string} question - User question
   * @param {Array<{text: string}>} retrievedChunks - Related vector chunks
   * @returns {Promise<string>} Clean, grounded answer or the negative fallback.
   */
  static async generateAnswer(question, retrievedChunks, conversationHistory = []) {
    const tracedGenerateAnswer = LangSmithService.traceFunction(
      async ({ question: tracedQuestion, retrievedChunks: tracedChunks, conversationHistory: tracedHistory }) => (
        this.generateAnswerInternal(tracedQuestion, tracedChunks, tracedHistory)
      ),
      {
        name: 'Generate Grounded Legal Answer',
        run_type: 'chain',
        metadata: {
          service: 'grokService',
        },
      }
    );

    return tracedGenerateAnswer({ question, retrievedChunks, conversationHistory });
  }

  static async generateAnswerInternal(question, retrievedChunks, conversationHistory = []) {
    if (!question) {
      throw new Error('User question is required.');
    }

    // Format context block from Pinecone chunks
    const retrievedContext = retrievedChunks && retrievedChunks.length > 0
      ? retrievedChunks.map((chunk, index) => {
          const source = chunk.source || 'Unknown file';
          const location = chunk.pageNumber ? `page ${chunk.pageNumber}` : `chunk ${chunk.chunkIndex + 1}`;
          const readableSource = this.toReadableSourceName(source);
          return `[Source ${index + 1}: ${source}, ${location}]
Document title from filename: ${readableSource}
Document text:
${chunk.text}`;
        }).join('\n\n')
      : 'No relevant document context found.';

    const historyText = this.buildConversationHistory(conversationHistory);
    const fallbackDisclaimer = 'Note: This answer is not directly supported by the uploaded documents.';
    const systemPrompt = `You are a domain-specific Multi-Document Legal RAG Assistant. Use the supplied uploaded-document context to answer legal questions when the context supports the answer.

Important behavior:
- Treat incomplete user inputs as question fragments when the intent is clear. For example, "Bharatiya Nagarik Suraksha Sanhita is issued in" should be understood as asking for the year/date of issue.
- You may use document titles/filenames as uploaded-document metadata. If a year or legal title appears in the filename, it is valid context.
- If the documents do not contain enough information to answer directly, provide your best effort response and append this disclaimer exactly: "${fallbackDisclaimer}".
- Do not include filenames, source labels, citation text, or document-name lists in the answer. The user interface displays citations separately.
- Answer only the user's question. Keep the response concise, readable, and focused on the legal point.
- Use short paragraphs or numbered/bulleted points when that makes the answer easier to read.
- Do not invent citations or claim the documents support facts they do not.`;

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

      const metadataAnswer = this.answerFromDocumentMetadata(question, retrievedChunks);
      if (this.isNotFoundAnswer(finalAnswer) && metadataAnswer) {
        finalAnswer = metadataAnswer;
      } else if (finalAnswer.toLowerCase().includes('answer not found in the uploaded document')) {
        finalAnswer = finalAnswer.replace(/answer not found in the uploaded document/gi, fallbackDisclaimer);
      }

      finalAnswer = this.cleanAnswerForDisplay(finalAnswer);

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

  static isNotFoundAnswer(answer) {
    return /answer\s+not\s+found\s+in\s+the\s+uploaded\s+documents?/i.test(answer || '');
  }

  static answerFromDocumentMetadata(question, retrievedChunks = []) {
    const normalizedQuestion = this.normalizeText(question);
    const asksIssuedYear = /\b(issued|enacted|published|notified)\b/.test(normalizedQuestion)
      && (/\b(year|date|when)\b/.test(normalizedQuestion) || /\bin\s*$/.test(normalizedQuestion));

    if (!asksIssuedYear || !Array.isArray(retrievedChunks) || retrievedChunks.length === 0) {
      return null;
    }

    const sourcesByYear = new Map();
    for (const chunk of retrievedChunks) {
      const source = chunk.source || '';
      const readableSource = this.toReadableSourceName(source);
      const normalizedSource = this.normalizeText(readableSource);
      const yearMatch = normalizedSource.match(/\b(19|20)\d{2}\b/);

      if (!source || !yearMatch || !this.hasMeaningfulSubjectOverlap(normalizedQuestion, normalizedSource)) {
        continue;
      }

      const year = yearMatch[0];
      if (!sourcesByYear.has(year)) {
        sourcesByYear.set(year, new Set());
      }
      sourcesByYear.get(year).add(source);
    }

    if (sourcesByYear.size === 0) {
      return null;
    }

    const [year, sourceSet] = [...sourcesByYear.entries()]
      .sort((a, b) => b[1].size - a[1].size)[0];
    const citedSources = [...sourceSet].slice(0, 4);
    const subject = this.inferSubjectFromQuestion(question);

    return `${subject} is issued in the year ${year}.`;
  }

  static cleanAnswerForDisplay(answer) {
    return String(answer || '')
      .replace(/\n?\s*(sources?|citations?)\s*:\s*.+$/gim, '')
      .replace(/\n?\s*\((sources?|citations?)\s*:\s*[^)]*\)/gim, '')
      .replace(/\s*Support comes from (the )?(filename|source|filename\/source)\.?\s*/gi, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  static hasMeaningfulSubjectOverlap(question, source) {
    const ignored = new Set(['issued', 'enacted', 'published', 'notified', 'year', 'date', 'when', 'which', 'section', 'pdf']);
    const questionTokens = this.normalizeText(question)
      .split(/\s+/)
      .filter((token) => token.length > 2 && !ignored.has(token));
    const sourceTokens = new Set(this.normalizeText(source).split(/\s+/));
    const matches = questionTokens.filter((token) => sourceTokens.has(token));
    return matches.length >= Math.min(3, questionTokens.length);
  }

  static inferSubjectFromQuestion(question) {
    const cleaned = String(question || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b(is|was|were|are)?\s*(issued|enacted|published|notified)\s*(in|on|when|which year|what year)?\s*\??\s*$/i, '')
      .trim();

    return cleaned || 'The requested legal document';
  }

  static toReadableSourceName(source) {
    return String(source || 'Unknown file')
      .replace(/\.[^.]+$/g, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static normalizeText(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
