import { GrokService } from './grokService.js';

export class QueryOptimizerService {
  static async optimizeQuery(originalQuery, conversationHistory = []) {
    if (!originalQuery || typeof originalQuery !== 'string') {
      return originalQuery;
    }

    try {
      const historyText = this.buildConversationHistory(conversationHistory);
      const prompt = `Rewrite the user query into a retrieval-optimized search query for document retrieval. Preserve the user's original intent, expand short or ambiguous phrases, and keep queries focused on the uploaded document content. Do not hallucinate new facts.

If the query is an incomplete fragment, infer only the missing question shape, not the answer. For example:
- "Bharatiya_Nagarik_Suraksha_Sanhita is issued in" -> "Bharatiya Nagarik Suraksha Sanhita issued in which year date"
- "is there any law related to ai" -> "law related to artificial intelligence AI legal provisions"

Original Query:
${originalQuery}

Conversation History:
${historyText}

Please provide only the rewritten query in one sentence or phrase.`;

      const response = await GrokService.chatCompletion({
        temperature: 0.0,
        max_tokens: 80,
        messages: [
          { role: 'system', content: 'You are a query optimization assistant for retrieval systems.' },
          { role: 'user', content: prompt },
        ],
      });

      const optimized = response.choices?.[0]?.message?.content?.trim();
      if (!optimized) {
        return originalQuery;
      }

      return optimized;
    } catch (error) {
      console.warn('[QUERY OPTIMIZER] Failed to optimize query, falling back to original query.', error);
      return originalQuery;
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
      .slice(-6)
      .map((item) => `${item.sender === 'user' ? 'User' : 'Assistant'}: ${item.text}`)
      .join('\n');
  }
}
