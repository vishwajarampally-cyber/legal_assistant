import React, { useRef, useState } from 'react';
import axios from 'axios';

const MAX_FILES = 50;
const UPLOAD_BATCH_SIZE = 10;
const VALID_EXTENSIONS = ['pdf', 'docx', 'txt'];

export default function FileUploader({
  uploadedFiles = [],
  onUploadSuccess,
  onReset,
  backendUrl,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(Array.from(e.dataTransfer.files || []));
  };

  const handleFileSelect = (e) => {
    processFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };

  const triggerFileSelect = () => {
    if (fileInputRef.current && !isUploading) {
      fileInputRef.current.click();
    }
  };

  const simulatePipeline = () => {
    setPipelineStep(1);
    const parseTimer = setTimeout(() => setPipelineStep(2), 1100);
    const chunkTimer = setTimeout(() => setPipelineStep(3), 2200);
    const embedTimer = setTimeout(() => setPipelineStep(4), 3300);
    return () => {
      clearTimeout(parseTimer);
      clearTimeout(chunkTimer);
      clearTimeout(embedTimer);
    };
  };

  const processFiles = async (files) => {
    if (!files.length) return;

    if (uploadedFiles.length + files.length > MAX_FILES) {
      setErrorMsg(`You can upload up to ${MAX_FILES} legal documents in one workspace.`);
      return;
    }

    const invalidFile = files.find((file) => {
      const extension = file.name.split('.').pop().toLowerCase();
      return !VALID_EXTENSIONS.includes(extension);
    });

    if (invalidFile) {
      setErrorMsg(`Unsupported file type: ${invalidFile.name}. Please upload PDF, DOCX, or TXT files.`);
      return;
    }

    setErrorMsg('');
    setIsUploading(true);
    setUploadProgress(0);
    setPipelineStep(0);
    setUploadStatus(`Preparing ${files.length} file${files.length === 1 ? '' : 's'} for upload...`);
    const cleanupPipeline = simulatePipeline();

    try {
      const indexedFiles = [];
      const totalBatches = Math.ceil(files.length / UPLOAD_BATCH_SIZE);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
        const start = batchIndex * UPLOAD_BATCH_SIZE;
        const batch = files.slice(start, start + UPLOAD_BATCH_SIZE);
        const formData = new FormData();
        batch.forEach((file) => formData.append('files', file));

        setUploadStatus(`Uploading batch ${batchIndex + 1} of ${totalBatches} (${batch.length} file${batch.length === 1 ? '' : 's'})...`);

        const response = await axios.post(`${backendUrl}/api/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (event) => {
            if (!event.total) return;
            const batchPercent = event.loaded / event.total;
            const overallPercent = ((batchIndex + batchPercent) / totalBatches) * 85;
            setUploadProgress(overallPercent);
          },
        });

        indexedFiles.push(...(response.data.files || []));
        onUploadSuccess((response.data.files || []).map((file) => ({
          name: file.filename,
          chunkCount: file.chunkCount,
          charCount: file.charCount,
        })));
      }

      cleanupPipeline();
      setPipelineStep(5);
      setUploadProgress(100);
      setUploadStatus(`Indexed ${indexedFiles.length} legal document${indexedFiles.length === 1 ? '' : 's'} successfully.`);

      setTimeout(() => {
        setIsUploading(false);
        setUploadStatus('');
      }, 700);
    } catch (error) {
      cleanupPipeline();
      setIsUploading(false);
      setUploadProgress(0);
      setPipelineStep(0);
      setUploadStatus('');
      setErrorMsg(error.response?.data?.error || error.message || 'An error occurred during file ingestion.');
      console.error('File upload error:', error);
    }
  };

  const handleResetClick = async () => {
    if (uploadedFiles.length === 0) return;

    try {
      await Promise.all(
        uploadedFiles.map((file) => axios.delete(`${backendUrl}/api/reset`, { params: { filename: file.name } }))
      );
      uploadedFiles.forEach((file) => onReset(file.name));
      setPipelineStep(0);
      setUploadProgress(0);
      setErrorMsg('');
    } catch (error) {
      console.error('Reset error:', error);
      setErrorMsg('Failed to clear vector index context.');
    }
  };

  const totalChunks = uploadedFiles.reduce((sum, file) => sum + file.chunkCount, 0);
  const totalChars = uploadedFiles.reduce((sum, file) => sum + file.charCount, 0);

  return (
    <div className="glass-card">
      <h2>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-violet)' }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        Legal Corpus
      </h2>

      {uploadedFiles.length > 0 && (
        <div className="file-list">
          <h3>Uploaded Legal Documents</h3>
          <div className="file-list-grid">
            {uploadedFiles.map((file) => (
              <div key={file.name} className="file-item">
                <strong>{file.name}</strong>
                <span className="file-item-meta">{file.chunkCount} chunks - {(file.charCount / 1024).toFixed(1)}k chars</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className={`upload-area ${dragOver ? 'drag-over' : ''} ${isUploading ? 'disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={triggerFileSelect}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="file-input"
          onChange={handleFileSelect}
          accept=".pdf,.docx,.txt"
          multiple
          disabled={isUploading}
        />
        <div className="upload-icon-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </div>
        <p className="upload-text">Upload or drag legal documents</p>
        <p className="upload-subtext">PDF, DOCX, or TXT. Up to 50 files are searched together.</p>
      </div>

      {isUploading && (
        <div className="progress-container">
          <div className="progress-header">
            <span>{uploadStatus || 'Legal assistant pipeline in progress'}</span>
            <span>{Math.round(uploadProgress)}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
          <div className="pipeline-logs">
            <div className={`log-entry ${pipelineStep >= 1 ? (pipelineStep === 1 ? 'active' : 'complete') : 'pending'}`}>
              {pipelineStep === 1 && <span className="log-spinner" />}
              {pipelineStep > 1 ? 'Done' : '-'} Extracting legal text
            </div>
            <div className={`log-entry ${pipelineStep >= 2 ? (pipelineStep === 2 ? 'active' : 'complete') : 'pending'}`}>
              {pipelineStep === 2 && <span className="log-spinner" />}
              {pipelineStep > 2 ? 'Done' : '-'} Chunking document text
            </div>
            <div className={`log-entry ${pipelineStep >= 3 ? (pipelineStep === 3 ? 'active' : 'complete') : 'pending'}`}>
              {pipelineStep === 3 && <span className="log-spinner" />}
              {pipelineStep > 3 ? 'Done' : '-'} Creating semantic embeddings
            </div>
            <div className={`log-entry ${pipelineStep >= 4 ? (pipelineStep === 4 ? 'active' : 'complete') : 'pending'}`}>
              {pipelineStep === 4 && <span className="log-spinner" />}
              {pipelineStep > 4 ? 'Done' : '-'} Indexing legal corpus
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="error-box">
          {errorMsg}
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="stats-box">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-val">{uploadedFiles.length}</div>
              <div className="stat-label">Files</div>
            </div>
            <div className="stat-item">
              <div className="stat-val cyan">{totalChunks}</div>
              <div className="stat-label">Chunks</div>
            </div>
          </div>
          <div className="corpus-meta">{(totalChars / 1024).toFixed(1)}k searchable characters</div>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <button type="button" className="btn-icon-danger" onClick={handleResetClick} disabled={isUploading} title="Clear all indexed legal documents">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      )}
    </div>
  );
}
