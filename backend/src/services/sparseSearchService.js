import { bm25Score, termOverlapScore, safeTokenize } from '../utils/scoringUtils.js';

const MAX_KEYWORDS = 18;

export class SparseSearchService {
  static generateSparseText(text) {
    const tokens = safeTokenize(text);
    const freq = tokens.reduce((acc, token) => {
      acc[token] = (acc[token] || 0) + 1;
      return acc;
    }, {});

    const sortedTerms = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_KEYWORDS)
      .map(([term]) => term);

    return sortedTerms.join(' ');
  }

  static attachSparseMetadata(chunks) {
    return chunks.map((chunk) => ({
      pageContent: chunk.pageContent,
      metadata: {
        ...chunk.metadata,
        sparseText: this.generateSparseText(chunk.pageContent),
      },
    }));
  }

  static scoreChunk(query, chunk) {
    const textToScore = chunk.keywordText || chunk.metadata?.sparseText || chunk.text || '';
    const bm25 = bm25Score(query, textToScore);
    const overlap = termOverlapScore(query, chunk.text || chunk.pageContent || '');
    return Math.max(bm25, overlap);
  }
}
