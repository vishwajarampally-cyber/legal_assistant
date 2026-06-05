import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { NavLink, Routes, Route } from 'react-router-dom';
import FileUploader from './components/FileUploader.jsx';
import ChatInterface from './components/ChatInterface.jsx';
import EvaluationDashboard from './components/EvaluationDashboard.jsx';

export default function App() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL
    || (import.meta.env.PROD ? window.location.origin : 'http://127.0.0.1:5000');

  useEffect(() => {
    let isMounted = true;

    async function loadBackendDocuments() {
      try {
        console.log('[DOCUMENT LOAD] Fetching documents from:', `${BACKEND_URL}/api/documents`);
        const response = await axios.get(`${BACKEND_URL}/api/documents`);
        
        if (!isMounted) return;

        console.log('[DOCUMENT LOAD] Response received:', response.data);
        const backendFiles = (response.data.documents || []).map((file) => ({
          name: file.filename,
          chunkCount: file.chunkCount || 0,
          charCount: file.charCount || 0,
        }));

        console.log('[DOCUMENT LOAD] Processed files:', backendFiles);
        setUploadedFiles(backendFiles.slice(0, 50));
      } catch (error) {
        console.warn('[DOCUMENT LOAD ERROR]', error.message || error);
        console.error('[DOCUMENT LOAD DETAILS]', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: `${BACKEND_URL}/api/documents`,
        });
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
          <div>
            <h1 className="brand-name">Legal Assistant</h1>
            <span className="brand-version">Legal</span>
          </div>
        </div>

        <div className="header-actions">
          <nav className="top-nav">
            <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/">Workspace</NavLink>
            <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/evaluation">Evaluation</NavLink>
          </nav>
          <div className="status-badge">
            <div className={`status-dot ${hasDocuments ? 'active' : ''}`}></div>
            <span>
              {hasDocuments
                ? `${uploadedFiles.length} legal document${uploadedFiles.length === 1 ? '' : 's'} indexed`
                : 'Upload legal documents to begin'
              }
            </span>
          </div>
        </div>
      </header>

      <main className="app-content">
        <Routes>
          <Route
            path="/"
            element={(
              <div className="dashboard-grid">
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
              </div>
            )}
          />
          <Route path="/evaluation" element={<EvaluationDashboard backendUrl={BACKEND_URL} />} />
        </Routes>
      </main>
    </div>
  );
}
