const STOPWORDS = new Set([
  'the','a','an','and','or','is','are','was','were','be','been','being','of','in','on','for','with','that','this','these','those','at','by','from','to','as','it','its','into','about','than','but','also','not','only','such','if','when','while','where','how','what','which','who','whom','why','can','could','should','would'
]);

export function safeTokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

export function normalizeScore(value, min = 0, max = 1) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(min, Math.min(max, (value - min) / (max - min)));
}

export function bm25Score(query, content) {
  const queryTokens = safeTokenize(query);
  const docTokens = safeTokenize(content);
  if (queryTokens.length === 0 || docTokens.length === 0) {
    return 0;
  }

  const docFreq = docTokens.reduce((acc, token) => {
    acc[token] = (acc[token] || 0) + 1;
    return acc;
  }, {});

  const queryFreq = queryTokens.reduce((acc, token) => {
    acc[token] = (acc[token] || 0) + 1;
    return acc;
  }, {});

  const docLength = docTokens.length;
  const k1 = 1.2;
  const b = 0.75;
  const avgDocLength = Math.max(1, docLength);

  let score = 0;
  for (const [term, qFreq] of Object.entries(queryFreq)) {
    if (!docFreq[term]) continue;
    const termFreq = docFreq[term];
    const idf = Math.log(1 + (docTokens.length / (termFreq + 1)));
    const numerator = termFreq * (k1 + 1);
    const denominator = termFreq + k1 * (1 - b + (b * docLength) / avgDocLength);
    score += idf * (numerator / denominator) * qFreq;
  }

  return normalizeScore(score, 0, 15);
}

export function termOverlapScore(query, content) {
  const queryTokens = new Set(safeTokenize(query));
  const docTokens = new Set(safeTokenize(content));
  if (!queryTokens.size || !docTokens.size) return 0;

  const matches = Array.from(queryTokens).filter((token) => docTokens.has(token));
  return normalizeScore(matches.length / queryTokens.size, 0, 1);
}
