# RAG System with Ollama

A Retrieval-Augmented Generation system using Ollama (llama3.2) and the ollama-js library, built with Node.js.

## Project Structure

```
rag-ollama/
├── backend/          # Express API backend
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   ├── utils/        # Utility functions
│   │   └── index.js      # Entry point
│   ├── .env           # Environment variables
│   └── package.json   # Dependencies
│
└── frontend/         # React frontend
    ├── public/       # Static assets
    ├── src/
    │   ├── components/  # Reusable components
    │   ├── pages/       # Page components
    │   ├── services/    # API client
    │   └── utils/       # Utility functions
    ├── index.html    # HTML template
    └── package.json  # Dependencies
```

## Prerequisites

- Node.js (v14+)
- Ollama installed locally (with llama3.2 model pulled)

## Setup

1. Start Ollama service:
   ```
   ollama serve
   ```

2. Pull the llama3.2 model (if not already done):
   ```
   ollama pull llama3.2
   ```

3. Start the backend:
   ```
   cd backend
   npm install
   npm run dev
   ```

4. Start the frontend:
   ```
   cd frontend
   npm install
   npm run dev
   ```

5. Open your browser to http://localhost:3000

## Features

- Question answering with context from documents
- Real-time streaming responses
- Document management (add, view)
- Simple retrieval based on keyword matching

## API Endpoints

- `POST /api/rag/query` - Query the RAG system
- `GET /api/rag/query/stream` - Stream query responses in real-time
- `POST /api/rag/add-document` - Add a document to the knowledge base
- `GET /api/rag/documents` - Get all documents in the knowledge base

## Improvements for Production

For a production environment, consider:

1. Using a vector database (e.g., Pinecone, Weaviate, etc.)
2. Implementing proper text chunking and embedding
3. Adding authentication and user management
4. Persistent storage for documents
5. Implementing caching for frequent queries 

const { Ollama } = require('ollama');
const ollama = new Ollama(); 