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

# RAG-Ollama System

A Retrieval-Augmented Generation (RAG) system built with Ollama and ChromaDB, featuring a React frontend and Express backend.

## Prerequisites

- Node.js (v18+)
- Docker (for ChromaDB)
- Ollama installed locally (for LLM)

## Project Structure

- `frontend/` - React application
- `backend/` - Express API server
- `backend/utils-data/` - Directory for text and CSV files for importing
- `backend/data/conversations/` - Directory for storing conversation history
- `backend/src/scripts/` - Utility scripts for ChromaDB management

## Getting Started

1. Clone the repository
2. Install dependencies:

```bash
npm run install:all
```

3. Start ChromaDB (using Docker):

```bash
npm run start:chroma
```

4. Run the application (both frontend and backend):

```bash
npm run dev:all
```

The frontend will be available at http://localhost:5173 and the backend at http://localhost:5000.

## Available Scripts

### Root Level Scripts

- `npm run install:all` - Install dependencies for root, frontend, and backend
- `npm run dev:all` - Run both frontend and backend in development mode
- `npm run start:chroma` - Start the ChromaDB Docker container
- `npm run stop:chroma` - Stop the ChromaDB Docker container
- `npm run build` - Build the frontend for production

### Backend Scripts

- `npm run dev` - Run the backend in development mode
- `npm run start:chroma` - Start the ChromaDB Docker container
- `npm run check:chroma` - Check ChromaDB connectivity
- `npm run add:chroma-samples` - Add sample documents to ChromaDB
- `npm run query:chroma` - Query the ChromaDB collection
- `npm run import:csv-to-chroma` - Import CSV data to ChromaDB

### Utility Scripts

The `backend/src/scripts/` directory contains utility scripts for managing ChromaDB:

1. **add-to-chroma.js**: Manually adds documents to ChromaDB
2. **check-chroma.js**: Tests connectivity to ChromaDB
3. **delete-all-from-chroma.js**: Deletes all documents from a ChromaDB collection
4. **import-csv-to-chroma.js**: Imports CSV data directly into ChromaDB
5. **import_csv_to_docs.js**: Converts CSV files to text documents
6. **import_employee_data.js**: Imports employee attendance data
7. **query-chroma.js**: Tests querying capabilities of ChromaDB

To run these scripts directly:

```bash
cd backend/src/scripts
node <script-name>.js
```

## API Endpoints

### Document Management

- `POST /api/rag/query` - Query the LLM with context from documents
- `GET /api/rag/query/stream` - Stream query response from LLM
- `POST /api/rag/add-document` - Add a document to the knowledge base
- `POST /api/rag/upload-files` - Upload files to the knowledge base
- `GET /api/rag/documents` - Retrieve all documents
- `DELETE /api/rag/documents` - Delete all documents
- `POST /api/rag/sync-utils-data` - Sync files from utils-data directory
- `POST /api/rag/import-employee-data` - Import employee attendance data

### Chat Management

- `POST /api/rag/chat` - Create a chat message
- `GET /api/rag/chat/:conversationId/history` - Get chat history
- `DELETE /api/rag/chat/:conversationId` - Clear a conversation
- `GET /api/rag/chat/conversations` - Get all conversations
- `DELETE /api/rag/clear-all-data` - Clear all conversations

## Troubleshooting

- If ChromaDB isn't connecting, run `npm run check:chroma` to verify its status
- If the `dev:all` command fails, try running the frontend and backend separately:
  - Terminal 1: `cd frontend && npm run dev`
  - Terminal 2: `cd backend && npm run dev`
- Make sure Docker is running before starting ChromaDB

## Data Flow

1. Documents are stored in ChromaDB and processed into embeddings
2. User queries are matched against document embeddings to find relevant context
3. The LLM receives the query along with the retrieved context to generate an answer
4. The frontend displays the response and conversation history

# RAG-Ollama System

A Retrieval-Augmented Generation (RAG) system built with Ollama and ChromaDB, featuring a React frontend and Express backend.

## Prerequisites

- Node.js (v18+)
- Docker (for ChromaDB)
- Ollama installed locally (for LLM)

## Project Structure

- `frontend/` - React application
- `backend/` - Express API server
- `backend/utils-data/` - Directory for text and CSV files for importing
- `backend/data/conversations/` - Directory for storing conversation history
- `backend/src/scripts/` - Utility scripts for ChromaDB management

## Getting Started

1. Clone the repository
2. Install dependencies:

```bash
cd rag-ollama  # Important! Make sure you're in the rag-ollama directory
npm run install:all
```

3. Start ChromaDB (using Docker):

```bash
cd rag-ollama  # Important! Make sure you're in the rag-ollama directory
npm run start:chroma
```

4. Run the application (both frontend and backend):

```bash
cd rag-ollama  # Important! Make sure you're in the rag-ollama directory
npm run dev:all
```

The frontend will be available at http://localhost:5173 and the backend at http://localhost:5000.

## Available Scripts

### Root Level Scripts

- `npm run install:all` - Install dependencies for root, frontend, and backend
- `npm run dev:all` - Run both frontend and backend in development mode
- `npm run start:chroma` - Start the ChromaDB Docker container
- `npm run stop:chroma` - Stop the ChromaDB Docker container
- `npm run build` - Build the frontend for production

### Backend Scripts

- `npm run dev` - Run the backend in development mode
- `npm run start:chroma` - Start the ChromaDB Docker container
- `npm run check:chroma` - Check ChromaDB connectivity
- `npm run add:chroma-samples` - Add sample documents to ChromaDB
- `npm run query:chroma` - Query the ChromaDB collection
- `npm run import:csv-to-chroma` - Import CSV data to ChromaDB

### Utility Scripts

The `backend/src/scripts/` directory contains utility scripts for managing ChromaDB:

1. **add-to-chroma.js**: Manually adds documents to ChromaDB
2. **check-chroma.js**: Tests connectivity to ChromaDB
3. **delete-all-from-chroma.js**: Deletes all documents from a ChromaDB collection
4. **import-csv-to-chroma.js**: Imports CSV data directly into ChromaDB
5. **import_csv_to_docs.js**: Converts CSV files to text documents
6. **import_employee_data.js**: Imports employee attendance data
7. **query-chroma.js**: Tests querying capabilities of ChromaDB

To run these scripts directly:

```bash
cd rag-ollama/backend/src/scripts
node <script-name>.js
```

## API Endpoints

### Document Management

- `POST /api/rag/query` - Query the LLM with context from documents
- `GET /api/rag/query/stream` - Stream query response from LLM
- `POST /api/rag/add-document` - Add a document to the knowledge base
- `POST /api/rag/upload-files` - Upload files to the knowledge base
- `GET /api/rag/documents` - Retrieve all documents
- `DELETE /api/rag/documents` - Delete all documents
- `POST /api/rag/sync-utils-data` - Sync files from utils-data directory
- `POST /api/rag/import-employee-data` - Import employee attendance data

### Chat Management

- `POST /api/rag/chat` - Create a chat message
- `GET /api/rag/chat/:conversationId/history` - Get chat history
- `DELETE /api/rag/chat/:conversationId` - Clear a conversation
- `GET /api/rag/chat/conversations` - Get all conversations
- `DELETE /api/rag/clear-all-data` - Clear all conversations

## Troubleshooting

- If ChromaDB isn't connecting, run `npm run check:chroma` to verify its status
- If the `dev:all` command fails, try running the frontend and backend separately:
  - Terminal 1: `cd rag-ollama/frontend && npm run dev`
  - Terminal 2: `cd rag-ollama/backend && npm run dev`
- Make sure Docker is running before starting ChromaDB
- **IMPORTANT**: All npm commands must be run from the `rag-ollama` directory, not from the parent directory

## Data Flow

1. Documents are stored in ChromaDB and processed into embeddings
2. User queries are matched against document embeddings to find relevant context
3. The LLM receives the query along with the retrieved context to generate an answer
4. The frontend displays the response and conversation history