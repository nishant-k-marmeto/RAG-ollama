import { ChromaClient } from 'chromadb';
import { OllamaEmbeddingFunction } from './ollamaEmbeddings.js';

// Initialize ChromaClient with default settings
const client = new ChromaClient({
  path: process.env.CHROMA_URL || "http://localhost:8000",
  apiPath: process.env.CHROMA_API_PATH || "/api/v2",
  tenantName: "default_tenant" // Explicitly set tenant name
});

// Initialize the Ollama embedding function
const embeddingFunction = new OllamaEmbeddingFunction({
  model: 'nomic-embed-text',
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
  debugMode: process.env.DEBUG_EMBEDDINGS === 'true', // Enable based on environment variable
  debugOptions: {
    saveToFile: process.env.SAVE_EMBEDDINGS === 'true',
    outputDir: './debug-embeddings',
    logFull: false
  }
});

// Simple in-memory LRU cache for queries
const queryCache = new Map();
const MAX_CACHE_SIZE = 100;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Get or create a collection in ChromaDB
 * @param {string} name - Collection name
 * @returns {object} The ChromaDB collection
 */
export async function getOrCreateCollection(name = "rag_documents") {
  try {
    console.log(`Attempting to get or create collection: ${name}`);
    const collection = await client.getOrCreateCollection({
      name,
      metadata: {
        description: "RAG System Documents"
      },
      embeddingFunction
    });
    
    console.log(`Collection "${name}" ready`);
    return collection;
  } catch (error) {
    console.error(`Error getting/creating collection "${name}":`, error);
    throw error;
  }
}

/**
 * Adds an entry to the query cache
 * @param {string} cacheKey - Cache key
 * @param {object} results - Query results
 */
function addToCache(cacheKey, results) {
  // If cache is full, remove oldest entry
  if (queryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = queryCache.keys().next().value;
    queryCache.delete(oldestKey);
  }
  
  queryCache.set(cacheKey, {
    timestamp: Date.now(),
    results
  });
}

/**
 * Gets an entry from the query cache if valid
 * @param {string} cacheKey - Cache key
 * @returns {object|null} Query results or null if not found/expired
 */
function getFromCache(cacheKey) {
  if (!queryCache.has(cacheKey)) {
    return null;
  }
  
  const cachedData = queryCache.get(cacheKey);
  const age = Date.now() - cachedData.timestamp;
  
  // Check if cache entry is expired
  if (age > CACHE_TTL) {
    queryCache.delete(cacheKey);
    return null;
  }
  
  console.log(`ChromaDB: Cache hit for query: ${cacheKey}`);
  return cachedData.results;
}

/**
 * Generates a cache key for a query
 * @param {object} collection - The ChromaDB collection
 * @param {number} nResults - Number of results
 * @param {string[]} queryTexts - Query texts
 * @param {object} options - Additional query options
 * @returns {string} Cache key
 */
function generateCacheKey(collection, nResults, queryTexts, options = {}) {
  return `${collection.name}_${nResults}_${queryTexts.join('|')}_${JSON.stringify(options)}`;
}

/**
 * Query a collection for relevant documents
 * @param {object} collection - The ChromaDB collection
 * @param {number} nResults - Number of results to return
 * @param {string[]} queryTexts - Array of query texts
 * @param {object} options - Additional query options
 * @returns {object} Query results
 */
export async function queryCollection(collection, nResults, queryTexts, options = {}) {
  try {
    // Generate cache key based on query parameters
    const cacheKey = generateCacheKey(collection, nResults, queryTexts, options);
    
    // Check cache first
    const cachedResults = getFromCache(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }
    
    // Setup query parameters
    const queryParams = {
      nResults,
      queryTexts,
      include: ["metadatas", "documents", "distances"],
    };
    
    // Only add where clause if it's not empty
    if (options.where && Object.keys(options.where).length > 0) {
      queryParams.where = options.where;
    }
    
    // Only add whereDocument if it's not empty
    if (options.whereDocument && Object.keys(options.whereDocument).length > 0) {
      queryParams.whereDocument = options.whereDocument;
    }
    
    // Log query performance
    const startTime = Date.now();
    
    // Execute query with retries
    let results;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        results = await collection.query(queryParams);
        break; // Success, exit retry loop
      } catch (retryError) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw retryError; // Rethrow if all attempts failed
        }
        console.warn(`ChromaDB query attempt ${attempts} failed, retrying...`, retryError.message);
        await new Promise(resolve => setTimeout(resolve, 500 * attempts)); // Exponential backoff
      }
    }
    
    const endTime = Date.now();
    console.log(`ChromaDB query completed in ${endTime - startTime}ms`);
    
    // Cache the results
    addToCache(cacheKey, results);
    
    return results;
  } catch (error) {
    console.error('Error querying collection:', error);
    throw error;
  }
}

/**
 * Get all documents in a collection
 * @param {object} collection - The ChromaDB collection
 * @returns {object} All documents in the collection
 */
export async function getAllDocuments(collection) {
  try {
    return await collection.get();
  } catch (error) {
    console.error('Error getting all documents:', error);
    throw error;
  }
}

/**
 * Delete all documents from a collection
 * @param {object} collection - The ChromaDB collection
 * @returns {boolean} Success status
 */
export async function deleteAllDocuments(collection) {
  try {
    // First get all document IDs
    const allDocuments = await collection.get();
    
    if (allDocuments && allDocuments.ids && allDocuments.ids.length > 0) {
      // Delete all documents by their IDs
      await collection.delete({
        ids: allDocuments.ids
      });
      
      console.log(`Successfully deleted ${allDocuments.ids.length} documents from collection`);
      
      // Clear cache as content has changed
      queryCache.clear();
      
      return true;
    } else {
      console.log('No documents found in collection to delete');
      return true;
    }
  } catch (error) {
    console.error('Error deleting all documents:', error);
    throw error;
  }
} 