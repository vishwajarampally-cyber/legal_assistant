import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

export default function ChatInterface({ uploadedFiles = [], backendUrl }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [expandedCitationIndex, setExpandedCitationIndex] = useState(null);
  const feedEndRef = useRef(null);

  const hasDocuments = uploadedFiles.length > 0;

  const scrollToBottom = () => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  useEffect(() => {
    if (!hasDocuments) {
      setMessages([]);
      setExpandedCitationIndex(null);
    }
  }, [hasDocuments]);

  const buildConversationHistory = () => {
    return messages
      .slice(-8)
      .map((message) => `${message.sender === 'user' ? 'User' : 'Assistant'}: ${message.text}`)
      .join('\n');
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isThinking || !hasDocuments) return;

    const userQuestion = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text: userQuestion }]);
    setIsThinking(true);

    try {
      const response = await axios.post(`${backendUrl}/api/query`, {
        question: userQuestion,
        filenames: uploadedFiles.map((file) => file.name),
        conversationHistory: buildConversationHistory(),
      });

      const aiAnswer = response.data.finalAnswer || response.data.answer;
      const retrievedChunks = response.data.citations || response.data.retrievedChunks || [];

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: aiAnswer,
          retrievedChunks,
          rerankedChunks: response.data.rerankedChunks || [],
          isFallback: aiAnswer?.toLowerCase().includes('answer not found'),
        },
      ]);
    } catch (error) {
      console.error('Failed to query RAG backend:', error);
      const errMsg = error.response?.data?.error || error.message || 'An error occurred during query evaluation.';
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `Error: ${errMsg}`,
          isError: true,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const toggleCitation = (msgIndex) => {
    setExpandedCitationIndex((current) => (current === msgIndex ? null : msgIndex));
  };

  return (
    <div className="glass-card chat-console">
      <div className="chat-banner">
        <div className="brand-logo">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 3l7 4v5c0 4.5-2.9 8.3-7 9-4.1-.7-7-4.5-7-9V7l7-4z" />
          </svg>
        </div>
        <div className="chat-banner-info">
          <h2>Legal Assistant</h2>
          <p>
            {hasDocuments
              ? `Searching ${uploadedFiles.length} uploaded legal document${uploadedFiles.length === 1 ? '' : 's'} with strict grounding`
              : 'Upload legal documents to activate grounded search'}
          </p>
        </div>
      </div>

      <div className="message-feed">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3l7 4v5c0 4.5-2.9 8.3-7 9-4.1-.7-7-4.5-7-9V7l7-4z" />
              </svg>
            </div>
            <h3>Grounded Legal Q&A Ready</h3>
            <p>
              {hasDocuments
                ? 'Ask a legal question. The assistant will answer only from the uploaded documents and cite the matching chunks.'
                : 'Upload PDF, DOCX, or TXT legal documents on the left panel to initialize the searchable corpus.'}
            </p>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`message-bubble ${msg.sender}`}>
            <div className="bubble-avatar">
              {msg.sender === 'user' ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.25l7.5 4.2v5.55c0 4.72-3.04 8.82-7.5 9.75-4.46-.93-7.5-5.03-7.5-9.75V6.45l7.5-4.2z" />
                </svg>
              )}
            </div>

            <div className="bubble-content">
              <div className={`bubble-text ${msg.isFallback ? 'fallback' : ''} ${msg.isError ? 'fallback' : ''}`}>
                {msg.text}
              </div>

              {msg.sender === 'ai' && msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                <div className="citations-box">
                  <button
                    className={`citations-toggle ${expandedCitationIndex === index ? 'expanded' : ''}`}
                    onClick={() => toggleCitation(index)}
                    type="button"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                    {expandedCitationIndex === index ? 'Hide Citations' : `View Citations (${msg.retrievedChunks.length})`}
                  </button>

                  {expandedCitationIndex === index && (
                    <div className="citations-content">
                      {msg.retrievedChunks.map((chunk, cIdx) => (
                        <div key={cIdx} className="citation-card">
                          <div className="citation-meta">
                            <span className="citation-name">{chunk.source || 'Unknown file'} - Chunk #{(chunk.chunkIndex ?? 0) + 1}</span>
                            <span className="citation-match">{chunk.pageNumber ? `Page ${chunk.pageNumber}` : 'Page N/A'}</span>
                          </div>
                          <div className="citation-text">"{chunk.text}"</div>
                          <div className="citation-meta debug-small">
                            <span>Score: {Math.round((chunk.score ?? 0) * 100)}%</span>
                            <span>Rerank: {Math.round((chunk.rerankScore ?? chunk.score ?? 0) * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="message-bubble ai typing-bubble">
            <div className="typing-dots">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}

        <div ref={feedEndRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSend}>
        <div className="input-container">
          <input
            type="text"
            className="query-input"
            placeholder={hasDocuments ? 'Ask a question across the uploaded legal documents...' : 'Upload legal documents to unlock the assistant...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!hasDocuments || isThinking}
          />
          <button
            type="submit"
            className="btn-send"
            disabled={!hasDocuments || isThinking || !input.trim()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
