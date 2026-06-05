import { EvaluationService } from '../services/evaluationService.js';

export async function runEvaluation(req, res, next) {
  try {
    const evaluationPayload = {
      question: req.body.question,
      answer: req.body.answer,
      retrieved_contexts: req.body.retrieved_contexts,
      ground_truth: req.body.ground_truth,
    };

    const result = await EvaluationService.runEvaluation(evaluationPayload);
    return res.status(200).json({ success: true, evaluation: result });
  } catch (error) {
    next(error);
  }
}

export async function getLatestEvaluation(req, res, next) {
  try {
    const latest = await EvaluationService.getLatestEvaluation();
    return res.status(200).json({ success: true, latest });
  } catch (error) {
    next(error);
  }
}

export async function getHistory(req, res, next) {
  try {
    const limit = Number(req.query.limit || 50);
    const history = await EvaluationService.getHistory(limit);
    return res.status(200).json({ success: true, history });
  } catch (error) {
    next(error);
  }
}

export async function getAnalytics(req, res, next) {
  try {
    const analytics = await EvaluationService.getAnalytics();
    return res.status(200).json({ success: true, analytics });
  } catch (error) {
    next(error);
  }
}
