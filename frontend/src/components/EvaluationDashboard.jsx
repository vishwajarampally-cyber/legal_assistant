import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { jsPDF } from 'jspdf';
import Papa from 'papaparse';

const metricColors = {
  good: '#10b981',
  average: '#f59e0b',
  poor: '#ef4444',
};

function getStatusColor(value) {
  if (value >= 0.8) return metricColors.good;
  if (value >= 0.6) return metricColors.average;
  return metricColors.poor;
}

function formatPercent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function leaderboardLabel(score) {
  if (score >= 0.9) return 'Excellent';
  if (score >= 0.75) return 'Good';
  if (score >= 0.6) return 'Average';
  return 'Needs Improvement';
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function generateInsights(latest) {
  const insights = [];
  if (!latest) return insights;
  if (latest.context_recall < 0.7) {
    insights.push('Retriever is missing relevant legal documents.');
  }
  if (latest.faithfulness < 0.7) {
    insights.push('LLM is generating unsupported legal information.');
  }
  if (latest.context_precision < 0.7) {
    insights.push('Too many irrelevant chunks are being retrieved.');
  }
  if (latest.answer_relevancy < 0.7) {
    insights.push('The response may not be fully aligned with the user intent.');
  }
  if (!insights.length) {
    insights.push('RAG pipeline is performing well. Keep document coverage and grounding tight.');
  }
  return insights;
}

export default function EvaluationDashboard({ backendUrl }) {
  const [analytics, setAnalytics] = useState(null);
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualInput, setManualInput] = useState({
    question: '',
    answer: '',
    retrieved_contexts: '',
    ground_truth: '',
  });
  const [manualResult, setManualResult] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [analyticsRes, historyRes, latestRes] = await Promise.all([
        axios.get(`${backendUrl}/api/evaluation/analytics`),
        axios.get(`${backendUrl}/api/evaluation/history?limit=25`),
        axios.get(`${backendUrl}/api/evaluation/latest`),
      ]);

      setAnalytics(analyticsRes.data.analytics || null);
      setHistory(historyRes.data.history || []);
      setLatest(latestRes.data.latest || null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Unable to load evaluation data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [backendUrl]);

  const barData = useMemo(() => {
    if (!latest) return [];
    return [
      { label: 'Faithfulness', value: latest.faithfulness },
      { label: 'Relevancy', value: latest.answer_relevancy },
      { label: 'Precision', value: latest.context_precision },
      { label: 'Recall', value: latest.context_recall },
      { label: 'Noise', value: latest.noise_sensitivity },
    ];
  }, [latest]);

  const lineData = useMemo(() => history.slice().reverse().map((item) => ({
    timestamp: formatDate(item.timestamp),
    faithfulness: Number(item.faithfulness.toFixed(3)),
    relevancy: Number(item.answer_relevancy.toFixed(3)),
    precision: Number(item.context_precision.toFixed(3)),
    recall: Number(item.context_recall.toFixed(3)),
  })), [history]);

  const handleManualChange = (field, value) => {
    setManualInput((prev) => ({ ...prev, [field]: value }));
  };

  const handleRunManualEvaluation = async () => {
    setError('');
    try {
      const response = await axios.post(`${backendUrl}/api/evaluation/run`, {
        question: manualInput.question,
        answer: manualInput.answer,
        retrieved_contexts: manualInput.retrieved_contexts
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        ground_truth: manualInput.ground_truth,
      });
      setManualResult(response.data.evaluation);
      await fetchData();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Manual evaluation failed.');
    }
  };

  const downloadCsv = () => {
    const csvData = history.map((item) => ({
      query: item.query,
      faithfulness: item.faithfulness,
      answer_relevancy: item.answer_relevancy,
      context_precision: item.context_precision,
      context_recall: item.context_recall,
      noise_sensitivity: item.noise_sensitivity,
      overall_score: item.overall_score,
      leaderboard: item.leaderboard,
      timestamp: item.timestamp,
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = 'evaluation-history.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    doc.setFontSize(16);
    doc.text('Legal Assistant RAGAS Evaluation Report', 40, 48);
    doc.setFontSize(11);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 68);
    if (analytics) {
      doc.text(`Average Faithfulness: ${formatPercent(analytics.averageFaithfulness)}`, 40, 100);
      doc.text(`Average Relevancy: ${formatPercent(analytics.averageRelevancy)}`, 40, 116);
      doc.text(`Average Precision: ${formatPercent(analytics.averagePrecision)}`, 40, 132);
      doc.text(`Average Recall: ${formatPercent(analytics.averageRecall)}`, 40, 148);
      doc.text(`Overall Score: ${formatPercent(analytics.overallAverage)}`, 40, 164);
    }
    doc.text('Top insights:', 40, 200);
    const insights = generateInsights(latest);
    insights.forEach((insight, index) => {
      doc.text(`- ${insight}`, 50, 220 + index * 16);
    });
    doc.save('evaluation-report.pdf');
  };

  const insights = generateInsights(latest);

  return (
    <div className="evaluation-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Evaluation Dashboard</p>
          <h1>RAGAS quality monitoring for legal retrieval</h1>
          <p className="page-copy">
            Monitor faithfulness, relevancy, precision, recall, and noise sensitivity for your legal assistant.
            Use the analytics panel to detect retriever drift and LLM hallucination risk.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn-secondary" onClick={downloadCsv} disabled={!history.length || loading}>Export CSV</button>
          <button type="button" className="btn-primary" onClick={downloadPdf} disabled={loading}>Download PDF</button>
        </div>
      </div>

      {error && <div className="alert-box">{error}</div>}
      {loading && <div className="alert-box alert-loading">Loading evaluation metrics…</div>}

      {!loading && !analytics && !history.length && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>No Evaluation Data Yet</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
            Run your first evaluation using the form below. Ask a question, provide the generated answer,
            retrieved contexts, and a ground truth reference — then click <strong>Run Evaluation</strong>.
          </p>
          <p style={{ color: 'var(--text-muted, #888)', fontSize: '0.85rem' }}>
            Metrics tracked: Faithfulness · Relevancy · Precision · Recall · Noise Sensitivity
          </p>
        </div>
      )}

      <section className="metrics-grid">
        {analytics && [
          { label: 'Average Faithfulness', value: analytics.averageFaithfulness },
          { label: 'Average Relevancy', value: analytics.averageRelevancy },
          { label: 'Average Precision', value: analytics.averagePrecision },
          { label: 'Average Recall', value: analytics.averageRecall },
          { label: 'Overall Score', value: analytics.overallAverage },
        ].map((metric) => (
          <div key={metric.label} className="metric-card glass-card">
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value" style={{ color: getStatusColor(metric.value) }}>{formatPercent(metric.value)}</div>
          </div>
        ))}
      </section>

      <section className="charts-grid">
        <div className="glass-card chart-card">
          <h2>Latest Evaluation</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" tick={{ fill: '#c4c4d6', fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `${Math.round(value * 100)}`} tick={{ fill: '#c4c4d6', fontSize: 12 }} />
                <Tooltip formatter={(value) => `${Math.round(value * 100)}%`} />
                <Bar dataKey="value" fill="var(--accent-cyan)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card chart-card">
          <h2>Historical Trend</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={lineData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="timestamp" tick={{ fill: '#c4c4d6', fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={70} />
                <YAxis tickFormatter={(value) => `${Math.round(value * 100)}%`} tick={{ fill: '#c4c4d6', fontSize: 12 }} />
                <Tooltip formatter={(value) => `${Math.round(value * 100)}%`} />
                <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ color: '#d4d4e1' }} />
                <Line type="monotone" dataKey="faithfulness" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="relevancy" stroke="#38bdf8" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="precision" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="recall" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="history-panel glass-card">
        <div className="section-header">
          <h2>Query History</h2>
          <span>{history.length} recent evaluations</span>
        </div>
        <div className="history-table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th>Query</th>
                <th>Faithfulness</th>
                <th>Relevancy</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.timestamp + item.query}>
                  <td>{item.query}</td>
                  <td style={{ color: getStatusColor(item.faithfulness) }}>{formatPercent(item.faithfulness)}</td>
                  <td style={{ color: getStatusColor(item.answer_relevancy) }}>{formatPercent(item.answer_relevancy)}</td>
                  <td style={{ color: getStatusColor(item.context_precision) }}>{formatPercent(item.context_precision)}</td>
                  <td style={{ color: getStatusColor(item.context_recall) }}>{formatPercent(item.context_recall)}</td>
                  <td>{formatDate(item.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="insights-grid">
        <div className="glass-card insights-card">
          <h2>Performance Insights</h2>
          <ul>
            {insights.map((insight) => (
              <li key={insight}>{insight}</li>
            ))}
          </ul>
        </div>

        <div className="glass-card run-eval-card">
          <h2>Run Evaluation</h2>
          <div className="manual-form">
            <label>
              User Query
              <textarea value={manualInput.question} onChange={(event) => handleManualChange('question', event.target.value)} rows={2} />
            </label>
            <label>
              Generated Answer
              <textarea value={manualInput.answer} onChange={(event) => handleManualChange('answer', event.target.value)} rows={3} />
            </label>
            <label>
              Retrieved Contexts (one per line)
              <textarea value={manualInput.retrieved_contexts} onChange={(event) => handleManualChange('retrieved_contexts', event.target.value)} rows={4} />
            </label>
            <label>
              Ground Truth / Reference
              <textarea value={manualInput.ground_truth} onChange={(event) => handleManualChange('ground_truth', event.target.value)} rows={3} />
            </label>
            <button type="button" className="btn-primary" onClick={handleRunManualEvaluation} disabled={!manualInput.question || !manualInput.answer || loading}>Run Evaluation</button>
            {manualResult && (
              <div className="manual-result">
                <h3>Manual Evaluation</h3>
                <div className="manual-result-grid">
                  <div><strong>Overall</strong><span>{formatPercent(manualResult.overall_score)}</span></div>
                  <div><strong>Rating</strong><span>{manualResult.leaderboard}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
