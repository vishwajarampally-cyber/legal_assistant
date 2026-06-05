import { getEvaluationRecords, saveEvaluationRecord } from './mongoService.js';

function normalize(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function tokenizeText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function jaccardSimilarity(a, b) {
  const setA = new Set(tokenizeText(a));
  const setB = new Set(tokenizeText(b));
  if (!setA.size || !setB.size) return 0;
  const intersection = Array.from(setA).filter((token) => setB.has(token)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function overlapCoverage(candidate, reference) {
  const tokensA = new Set(tokenizeText(candidate));
  const tokensB = new Set(tokenizeText(reference));
  if (!tokensA.size || !tokensB.size) return 0;
  const overlap = Array.from(tokensA).filter((token) => tokensB.has(token)).length;
  return overlap / tokensB.size;
}

function average(list) {
  if (!Array.isArray(list) || list.length === 0) return 0;
  return list.reduce((acc, value) => acc + normalize(value), 0) / list.length;
}

function computeNoiseSensitivity(retrievedContexts = [], answer = '') {
  if (!Array.isArray(retrievedContexts) || retrievedContexts.length === 0) return 0.5;
  const answerTokens = new Set(tokenizeText(answer));
  const scores = retrievedContexts.map((context) => {
    const overlap = overlapCoverage(context, answer);
    return overlap;
  });
  const averageOverlap = average(scores);
  return normalize(Math.max(0, averageOverlap * 1.1 - 0.1));
}

function computeFaithfulness(answer, contexts, groundTruth) {
  const answerGroundTruth = groundTruth ? jaccardSimilarity(answer, groundTruth) : 0;
  const answerContext = contexts.length > 0 ? average(contexts.map((context) => jaccardSimilarity(answer, context))) : 0;
  return normalize(Math.max(answerGroundTruth, answerContext * 0.9));
}

function computeAnswerRelevancy(question, answer) {
  return normalize(jaccardSimilarity(question, answer));
}

function computeContextPrecision(retrievedContexts = [], answer, groundTruth) {
  if (!retrievedContexts.length) return 0;
  const relevanceScores = retrievedContexts.map((context) => {
    const contextToAnswer = jaccardSimilarity(context, answer);
    const contextToGroundTruth = groundTruth ? jaccardSimilarity(context, groundTruth) : 0;
    return Math.max(contextToAnswer, contextToGroundTruth);
  });
  return normalize(average(relevanceScores));
}

function computeContextRecall(retrievedContexts = [], groundTruth) {
  if (!groundTruth || !retrievedContexts.length) return 0;
  const chunkCoverage = retrievedContexts.map((context) => overlapCoverage(groundTruth, context));
  return normalize(Math.min(1, Math.max(...chunkCoverage)));
}

function getLeaderboardLabel(score) {
  if (score >= 0.9) return 'Excellent';
  if (score >= 0.75) return 'Good';
  if (score >= 0.6) return 'Average';
  return 'Needs Improvement';
}

export class EvaluationService {
  static async runEvaluation({ question, answer, retrieved_contexts = [], ground_truth = '' }) {
    const payload = {
      question: String(question || '').trim(),
      answer: String(answer || '').trim(),
      retrieved_contexts: Array.isArray(retrieved_contexts) ? retrieved_contexts.map(String) : [],
      ground_truth: String(ground_truth || '').trim(),
    };

    if (!payload.question || !payload.answer) {
      throw new Error('Question and answer are required for evaluation.');
    }

    const faithfulness = computeFaithfulness(payload.answer, payload.retrieved_contexts, payload.ground_truth);
    const answer_relevancy = computeAnswerRelevancy(payload.question, payload.answer);
    const context_precision = computeContextPrecision(payload.retrieved_contexts, payload.answer, payload.ground_truth);
    const context_recall = computeContextRecall(payload.retrieved_contexts, payload.ground_truth);
    const noise_sensitivity = computeNoiseSensitivity(payload.retrieved_contexts, payload.answer);
    const overall_score = normalize((faithfulness + answer_relevancy + context_precision + context_recall) / 4);
    const leaderboard = getLeaderboardLabel(overall_score);

    const record = {
      query: payload.question,
      answer: payload.answer,
      retrieved_contexts: payload.retrieved_contexts,
      ground_truth: payload.ground_truth,
      faithfulness,
      answer_relevancy,
      context_precision,
      context_recall,
      noise_sensitivity,
      overall_score,
      leaderboard,
      timestamp: new Date().toISOString(),
    };

    try {
      await saveEvaluationRecord(record);
    } catch (error) {
      console.warn('[EVALUATION STORAGE WARNING] Evaluation data could not be saved.', error.message);
    }

    return record;
  }

  static async getLatestEvaluation() {
    try {
      const history = await getEvaluationRecords(1);
      return history.length > 0 ? history[0] : null;
    } catch (error) {
      console.warn('[EVALUATION STORAGE WARNING] Could not read latest evaluation.', error.message);
      return null;
    }
  }

  static async getHistory(limit = 50) {
    try {
      return await getEvaluationRecords(limit);
    } catch (error) {
      console.warn('[EVALUATION STORAGE WARNING] Could not read evaluation history.', error.message);
      return [];
    }
  }

  static async getAnalytics() {
    const history = await this.getHistory(100);
    if (!history.length) {
      return {
        averageFaithfulness: 0,
        averageRelevancy: 0,
        averagePrecision: 0,
        averageRecall: 0,
        averageNoiseSensitivity: 0,
        overallAverage: 0,
        recordCount: 0,
      };
    }

    const averageFaithfulness = average(history.map((item) => item.faithfulness));
    const averageRelevancy = average(history.map((item) => item.answer_relevancy));
    const averagePrecision = average(history.map((item) => item.context_precision));
    const averageRecall = average(history.map((item) => item.context_recall));
    const averageNoiseSensitivity = average(history.map((item) => item.noise_sensitivity));
    const overallAverage = normalize((averageFaithfulness + averageRelevancy + averagePrecision + averageRecall) / 4);

    return {
      averageFaithfulness,
      averageRelevancy,
      averagePrecision,
      averageRecall,
      averageNoiseSensitivity,
      overallAverage,
      recordCount: history.length,
    };
  }
}
