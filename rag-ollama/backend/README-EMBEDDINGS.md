# Embedding Debugging Guide

This guide explains how to debug and visualize embeddings in the RAG application.

## Overview

The application uses Ollama's `nomic-embed-text` model to generate embeddings for documents. These embeddings are stored in ChromaDB and used for semantic search and retrieval.

## Enabling Debug Mode

You can enable debugging of embeddings by setting the `DEBUG_EMBEDDINGS` environment variable:

```bash
DEBUG_EMBEDDINGS=true npm start
```

This will log details about each embedding being generated, including:
- Vector dimension
- Statistical information (min, max, mean, standard deviation)
- Sample of the vector values

## Saving Embeddings to File

To save embeddings to JSON files for further analysis:

```bash
DEBUG_EMBEDDINGS=true SAVE_EMBEDDINGS=true npm start
```

Embeddings will be saved to the `./debug-embeddings` directory (configurable in the code).

## Running the Test Script

A test script is provided to generate embeddings for sample texts:

```bash
node src/scripts/test-embeddings.js
```

This will:
1. Generate embeddings for several sample texts
2. Log detailed information about each embedding
3. Save the embeddings to the debug directory (if enabled)

## Understanding the Debug Output

The debug output includes:

### For individual embeddings:
```
----- EMBEDDING DEBUG -----
Text: This is a short test sentence.
Embedding dimension: 768
Stats: min=-0.2654, max=0.3418, mean=0.0001, std=0.0982
Sample values: [0.0425, 0.1254, -0.0512, 0.2167, 0.0843...
--------------------------
```

### For batch embeddings:
```
===== BATCH EMBEDDINGS DEBUG =====
Total embeddings: 4
Dimension: 768
Similarity analysis (cosine similarity to first embedding):
  Text 2 similarity: 0.7651
  Text 3 similarity: 0.6894
  Text 4 similarity: 0.5342
==================================
```

## Configuration Options

You can configure embedding debugging in `chromadb.js`:

```javascript
const embeddingFunction = new OllamaEmbeddingFunction({
  model: 'nomic-embed-text',
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
  debugMode: process.env.DEBUG_EMBEDDINGS === 'true',
  debugOptions: {
    saveToFile: process.env.SAVE_EMBEDDINGS === 'true',
    outputDir: './debug-embeddings',
    logFull: false  // Set to true to log entire vectors (very verbose!)
  }
});
```

## Programmatic Control

You can also enable/disable debugging programmatically:

```javascript
// Enable debugging
embeddingFunction.enableDebug({
  saveToFile: true,
  outputDir: './custom-debug-path',
  logFull: true
});

// Disable debugging
embeddingFunction.disableDebug();
``` 