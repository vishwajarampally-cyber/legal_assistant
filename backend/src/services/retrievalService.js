import { GrokService } from './grokService.js';
import { EmbeddingService } from './embeddingService.js';
import { VectorService } from './vectorService.js';
import { QueryOptimizerService } from './queryOptimizerService.js';
import { SparseSearchService } from './sparseSearchService.js';
import { RerankerService } from './rerankerService.js';
import { LangSmithService } from './langsmithService.js';
import {
  DENSE_TOP_K,
  HYBRID_TOP_K,
  RERANK_TOP_K,
  FINAL_CONTEXT_K,
  SEMANTIC_WEIGHT,
  KEYWORD_WEIGHT,
  SEMANTIC_FALLBACK_THRESHOLD,
} from '../config/constants.js';

export class RetrievalService {
  static async queryDocument({ question, filename, conversationHistory = [] }) {
    return this.queryDocuments({
      question,
      filenames: filename ? [filename] : [],
      conversationHistory,
    });
  }

  static async queryDocuments({ question, filenames = [], conversationHistory = [] }) {
    const tracedQueryDocuments = LangSmithService.traceFunction(
      async (input) => this.queryDocumentsInternal(input),
      {
        name: 'Legal RAG Query',
        run_type: 'chain',
        metadata: {
          service: 'retrievalService',
        },
      }
    );

    return tracedQueryDocuments({ question, filenames, conversationHistory });
  }

  static async queryDocumentsInternal({ question, filenames = [], conversationHistory = [] }) {
    const originalQuery = String(question || '').trim();
    if (!originalQuery) {
      throw new Error('The query body is required.');
    }

    const scopedFilenames = [...new Set((filenames || []).filter(Boolean))];
    if (scopedFilenames.length === 0) {
      throw new Error('At least one uploaded legal document is required to scope the query.');
    }

    const timestamps = {
      start: Date.now(),
      optimize: null,
      embed: null,
      dense: null,
      sparse: null,
      rerank: null,
      llm: null,
      end: null,
    };

    const optimizedQuery = await QueryOptimizerService.optimizeQuery(originalQuery, conversationHistory);
    timestamps.optimize = Date.now();

    const queryVector = await EmbeddingService.generateQueryEmbedding(optimizedQuery);
    timestamps.embed = Date.now();

    const candidatePool = await VectorService.querySimilarChunksAcrossFiles(queryVector, scopedFilenames, HYBRID_TOP_K);
    timestamps.dense = Date.now();

    const scoredCandidates = candidatePool.map((chunk) => {
      const keywordScore = SparseSearchService.scoreChunk(optimizedQuery, chunk);
      const combinedScore = SEMANTIC_WEIGHT * (chunk.score ?? 0) + KEYWORD_WEIGHT * keywordScore;
      return {
        ...chunk,
        keywordScore,
        combinedScore,
      };
    });

    timestamps.sparse = Date.now();

    let hybridChunks = scoredCandidates.sort((a, b) => b.combinedScore - a.combinedScore);
    if (hybridChunks.length > 0 && hybridChunks[0].score < SEMANTIC_FALLBACK_THRESHOLD) {
      hybridChunks = scoredCandidates.sort((a, b) => b.keywordScore - a.keywordScore);
    }

    const rerankedChunks = RerankerService.rerankChunks(hybridChunks.slice(0, RERANK_TOP_K), optimizedQuery);
    timestamps.rerank = Date.now();

    const finalChunks = rerankedChunks.slice(0, FINAL_CONTEXT_K).map((chunk, index) => ({
      id: `${chunk.filename}::${chunk.chunkIndex}`,
      text: chunk.text,
      score: chunk.rerankScore,
      source: chunk.filename,
      pageNumber: chunk.pageNumber ?? null,
      chunkIndex: chunk.chunkIndex,
      keywordScore: chunk.keywordScore,
      originalScore: chunk.score,
    }));

    const answer = await GrokService.generateAnswer(originalQuery, finalChunks, conversationHistory);
    timestamps.llm = Date.now();
    timestamps.end = Date.now();

    return {
      success: true,
      originalQuery,
      optimizedQuery,
      searchedFiles: scopedFilenames,
      retrievedChunks: scoredCandidates.slice(0, FINAL_CONTEXT_K).map((chunk) => ({
        id: `${chunk.filename}::${chunk.chunkIndex}`,
        text: chunk.text,
        score: chunk.score,
        keywordScore: chunk.keywordScore,
        combinedScore: chunk.combinedScore,
        source: chunk.filename,
        pageNumber: chunk.pageNumber ?? null,
        chunkIndex: chunk.chunkIndex,
      })),
      rerankedChunks: rerankedChunks.map((chunk) => ({
        id: `${chunk.filename}::${chunk.chunkIndex}`,
        text: chunk.text,
        rerankScore: chunk.rerankScore,
        originalScore: chunk.score,
        keywordScore: chunk.keywordScore,
        source: chunk.filename,
        pageNumber: chunk.pageNumber ?? null,
        chunkIndex: chunk.chunkIndex,
      })),
      finalAnswer: answer,
      citations: finalChunks,
      timingMetrics: {
        queryOptimizationMs: timestamps.optimize - timestamps.start,
        embeddingMs: timestamps.embed - timestamps.optimize,
        retrievalMs: timestamps.dense - timestamps.embed,
        sparseScoringMs: timestamps.sparse - timestamps.dense,
        rerankMs: timestamps.rerank - timestamps.sparse,
        llmMs: timestamps.llm - timestamps.rerank,
        totalMs: timestamps.end - timestamps.start,
      },
    };
  }
}
