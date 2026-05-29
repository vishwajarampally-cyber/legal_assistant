# Advanced RAG

Advanced RAG is a full-stack document question-answering assistant built for strict grounded retrieval, hybrid semantic + keyword search, query optimization, reranking, and citation transparency.

The app supports PDF, DOCX, and TXT uploads, and it uses Pinecone vector storage plus Groq-compatible LLM inference to answer only from uploaded document context.

---

## ?? What this project contains
- Frontend: **React + Vite** with a modern dashboard UI
- Backend: **Node.js + Express** with modular controllers and services
- Document ingestion: PDF / DOCX / TXT text extraction
- Chunking: recursive text splitting with overlap for robust context
- Embeddings: Pinecone Inference `multilingual-e5-large`
- Hybrid retrieval: dense semantic + sparse keyword search
- Query optimization: LLM-based retrieval rewrite and conversational context handling
- Reranking: cross-encoder-style relevance ranking before answer composition
- Strict grounding: answers only from retrieved document chunks
- Citations: segment id, score, file source, page info, and reranking details
- File management: multi-file upload, namespace isolation, replace support, and reset/delete

---

## ?? Project Structure

```
naive_rag/
+-- backend/
¦   +-- src/
¦   ¦   +-- config/
¦   ¦   +-- controllers/
¦   ¦   +-- middleware/
¦   ¦   +-- services/
¦   ¦   +-- routes/
¦   +-- index.js
¦   +-- package.json
¦   +-- vercel.json
¦   +-- .env.example
+-- frontend/
¦   +-- src/
¦   ¦   +-- components/
¦   ¦   +-- App.jsx
¦   ¦   +-- index.css
¦   ¦   +-- main.jsx
¦   +-- index.html
¦   +-- package.json
¦   +-- vercel.json
+-- README.md
```

---

## ?? Environment Setup

### Backend `.env`
```env
PORT=5000
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_API_URL=https://api.groq.com/openai/v1
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=your_pinecone_index_name_here
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langsmith_api_key_here
LANGCHAIN_PROJECT=advanced-rag
```

### Frontend `.env`
```env
VITE_BACKEND_URL=http://localhost:5000
```

---

## ?? Local Run Commands

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## ?? Pinecone Setup

1. Sign in to [Pinecone](https://app.pinecone.io).
2. Create an index with:
   - **Dimension**: `1024`
   - **Metric**: `Cosine`
   - **Name**: the value used in `PINECONE_INDEX_NAME`
3. Copy the API key to `PINECONE_API_KEY`.

---

## ?? API Endpoints

### GET `/health`
Returns service health status.

### POST `/api/upload`
Upload a document file.

### POST `/api/query`
Request body:
```json
{
  "question": "Who is responsible for support policy?",
  "filename": "policy_document.pdf"
}
```

### DELETE `/api/reset?filename=<file>`
Deletes the file namespace and clears Pinecone vectors.

---

## ?? Vercel Deployment

### Backend
1. Deploy from `backend/`.
2. Set env vars in Vercel:
   - `LLM_PROVIDER`
   - `GROQ_API_KEY`
   - `GROQ_MODEL`
   - `GROQ_API_URL`
   - `PINECONE_API_KEY`
   - `PINECONE_INDEX_NAME`
3. Run `vercel --prod`.

### Frontend
1. Deploy from `frontend/`.
2. Set env var:
   - `VITE_BACKEND_URL=https://<your-backend-url>`
3. Run `vercel --prod`.

---

## ?? Grounding Rule
If the answer cannot be found in the retrieved document context, the assistant responds exactly:

`Answer not found in the uploaded document.`
