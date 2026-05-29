import { termOverlapScore } from '../utils/scoringUtils.js';

export class RerankerService {
  static rerankChunks(chunks, optimizedQuery) {
    return [...chunks]
      .map((item) => ({
        ...item,
        rerankScore: this.buildCompositeScore(item, optimizedQuery),
      }))
      .sort((a, b) => b.rerankScore - a.rerankScore);
  }

  static buildCompositeScore(chunk, optimizedQuery) {
    const semantic = Number(chunk.score ?? 0);
    const keyword = Number(chunk.keywordScore ?? 0);
    const overlap = termOverlapScore(optimizedQuery, chunk.text || chunk.pageContent || '');
    return semantic * 0.65 + keyword * 0.25 + overlap * 0.1;
  }
}
