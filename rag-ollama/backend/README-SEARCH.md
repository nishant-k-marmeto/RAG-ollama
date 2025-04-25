# Semantic Search Engine Documentation

This document explains how to use the semantic search engine in the RAG application.

## Overview

The search engine uses ChromaDB and the Ollama embedding model to find semantically relevant documents based on a query. Unlike traditional keyword search, semantic search understands the meaning and context of both the query and the documents.

## API Endpoints

### Search Documents

```
POST /api/rag/search
```

#### Request Body
```json
{
  "query": "What is JavaScript?",
  "limit": 5,
  "filters": {
    "type": "text"
  }
}
```

- `query` (required): The search query text
- `limit` (optional): Maximum number of results to return (default: 5)
- `filters` (optional): Metadata filters to apply to the search

#### Response
```json
{
  "success": true,
  "message": "Found 3 matching documents",
  "results": [
    {
      "id": "12345-abcde-67890",
      "content": "JavaScript is a programming language used to create interactive effects...",
      "metadata": {
        "source": "JavaScript Basics",
        "type": "text",
        "timestamp": "2023-06-15T10:30:00Z"
      },
      "similarity": 0.92
    },
    ...
  ],
  "query": "What is JavaScript?",
  "count": 3,
  "metrics": {
    "queryTimeMs": 156,
    "searchedCollection": "rag_documents"
  }
}
```

## Programming Interface

You can also use the search engine programmatically:

```javascript
import { queryDocuments } from '../services/documentService.js';

// Simple query
const results = await queryDocuments('What is JavaScript?');

// Advanced query with options
const results = await queryDocuments('React components', {
  limit: 10,
  filters: { type: 'text' },
  includeMetadata: true,
  includeDistances: true
});
```

### Options

- `limit`: Maximum number of results (default: 5)
- `collectionName`: The ChromaDB collection to search (default: 'rag_documents')
- `filters`: Metadata filters (e.g., `{ type: 'text' }`)
- `includeMetadata`: Whether to include metadata in results (default: true)
- `includeDistances`: Whether to include similarity scores (default: true)

## Filtering Results

You can filter results based on document metadata:

```javascript
// Filter by document type
const results = await queryDocuments('query', {
  filters: { type: 'text' }
});

// Filter by source
const results = await queryDocuments('query', {
  filters: { source: 'JavaScript Basics' }
});

// Multiple filters
const results = await queryDocuments('query', {
  filters: { 
    type: 'text',
    parentDocument: 'User Manual'
  }
});
```

## Testing the Search Engine

A test script is provided to demonstrate search capabilities:

```bash
# Run basic search test
node src/scripts/test-search.js

# Add test documents and then search
node src/scripts/test-search.js --add-docs
```

## Embedding Debug Mode

You can enable debug mode to see details about the embeddings used for search:

```bash
DEBUG_EMBEDDINGS=true npm start
```

This will log embedding vectors, statistics, and similarity scores during search operations.

## Performance Considerations

- The search operation involves generating embeddings for the query and performing vector similarity search
- Results include similarity scores (0-1, higher is better)
- Caching is implemented to improve performance for repeated queries
- Batch operations are used when possible to optimize embedding generation

## Integration with RAG Pipeline

The search engine is a core component of the RAG (Retrieval Augmented Generation) pipeline:

1. User submits a query
2. Search engine retrieves relevant documents using semantic search
3. Retrieved context is used to augment the prompt sent to the LLM
4. LLM generates a response based on both the query and the retrieved context 