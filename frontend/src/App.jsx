import React, { useEffect, useState } from 'react';
import axios from 'axios';
import FileUploader from './components/FileUploader.jsx';
import ChatInterface from './components/ChatInterface.jsx';

export default function App() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL
    || (import.meta.env.PROD ? window.location.origin : 'http://127.0.0.1:5000');

  useEffect(() => {
    let isMounted = true;

    async function loadBackendDocuments() {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/documents`);
        if (!isMounted) return;

        const backendFiles = (response.data.documents || []).map((file) => ({
          name: file.filename,
          chunkCount: file.chunkCount || 0,
          charCount: file.charCount || 0,
        }));

        setUploadedFiles(backendFiles.slice(0, 50));
      } catch (error) {
        console.warn('Could not load backend document catalog:', error.message || error);
      }
    }

    loadBackendDocuments();

    return () => {
      isMounted = false;
    };
  }, [BACKEND_URL]);

  const handleUploadSuccess = (files) => {
    const uploadedBatch = Array.isArray(files) ? files : [files];
    setUploadedFiles((prev) => {
      const incomingNames = new Set(uploadedBatch.map((item) => item.name));
      const filtered = prev.filter((item) => !incomingNames.has(item.name));
      return [...filtered, ...uploadedBatch].slice(0, 50);
    });
  };

  const handleReset = (filename) => {
    setUploadedFiles((prev) => prev.filter((item) => item.name !== filename));
  };

  const hasDocuments = uploadedFiles.length > 0;

  return (
    <div className="app-container">
      <div className="bg-visuals">
        <div className="orb orb-violet"></div>
        <div className="orb orb-indigo"></div>
        <div className="orb orb-cyan"></div>
      </div>

      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="brand-name">Legal Assistant</h1>
          <span className="brand-version">Legal</span>
        </div>

        <div className="status-badge">
          <div className={`status-dot ${hasDocuments ? 'active' : ''}`}></div>
          <span>
            {hasDocuments
              ? `${uploadedFiles.length} legal document${uploadedFiles.length === 1 ? '' : 's'} indexed`
              : 'Upload legal documents to begin'
            }
          </span>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="control-panel">
          <FileUploader
            uploadedFiles={uploadedFiles}
            onUploadSuccess={handleUploadSuccess}
            onReset={handleReset}
            backendUrl={BACKEND_URL}
          />
        </section>

        <section className="chat-panel">
          <ChatInterface
            uploadedFiles={uploadedFiles}
            backendUrl={BACKEND_URL}
          />
        </section>
      </main>
    </div>
  );
}
