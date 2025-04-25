import { Ollama } from 'ollama';
import { getOrCreateCollection, queryCollection } from '../utils/chromadb.js';

// Global reference for the Ollama client
let ollamaClient = null;

/**
 * Get or create an Ollama client with connection pooling
 * @returns {Ollama} The Ollama client instance
 */
function getOllamaClient() {
  if (!ollamaClient) {
    console.log('RAGService: Creating new Ollama client instance with keep-alive settings');
    ollamaClient = new Ollama({
      host: process.env.OLLAMA_HOST || 'http://localhost:11434',
      keepAlive: true,
      keepAliveMsecs: 300000, // 5 minutes
      headers: { 'Connection': 'keep-alive' }
    });
  }
  return ollamaClient;
}

/**
 * Ensures Ollama connection is working and reconnects if needed
 * @returns {boolean} Connection status
 */
async function ensureOllamaConnection() {
  try {
    // Simple health check by listing models
    await getOllamaClient().list();
    return true;
  } catch (error) {
    console.log("RAGService: Ollama connection failed, reconnecting...", error.message);
    // Reset client to force new connection
    ollamaClient = null;
    // Try to create new connection
    getOllamaClient();
    return false;
  }
}

/**
 * Query the LLM with context from ChromaDB
 * @param {string} userQuery The user's query
 * @param {number} numResults Number of results to fetch from ChromaDB
 * @returns {Promise<object>} The response including the answer and sources
 */
async function queryWithContext(userQuery, numResults = 3) {
  try {
    console.log(`RAGService: Processing query: "${userQuery.substring(0, 50)}${userQuery.length > 50 ? '...' : ''}"`);
    
    // Ensure Ollama connection is active
    await ensureOllamaConnection();
    
    // Get the collection
    const collection = await getOrCreateCollection('rag_documents');
    
    // Query for relevant documents
    console.log(`RAGService: Querying ChromaDB for relevant documents...`);
    const queryStartTime = Date.now();
    
    const results = await queryCollection(collection, numResults, [userQuery]);
    const queryEndTime = Date.now();
    console.log(`RAGService: ChromaDB query completed in ${queryEndTime - queryStartTime}ms`);
    
    let context = '';
    let sources = [];
    
    if (results && results.documents && results.documents[0] && results.documents[0].length > 0) {
      console.log(`RAGService: Found ${results.documents[0].length} relevant documents`);
      
      // Format documents from ChromaDB
      context = results.documents[0].join('\n\n');
      
      // Extract sources for citation
      sources = results.metadatas[0].map((metadata, index) => ({
        id: results.ids[0][index],
        title: metadata.source || `Document ${index + 1}`,
        content: results.documents[0][index].substring(0, 100) + '...'
      }));
    } else {
      console.log('RAGService: No relevant documents found in ChromaDB');
    }
    
    // Prepare prompt
    const messages = [];
    
    // System message with instructions
    messages.push({
      role: 'system',
      content: `You are a knowledgeable assistant with access to a specialized database.
      Your task is to answer the user's question using ONLY the information provided in the context below.
      If the context doesn't contain relevant information, acknowledge that you don't know.
      Do not make up information or use your training data to answer.`
    });
    
    // Add context as a separate message if we have it
    if (context) {
      messages.push({
        role: 'system', 
        content: `Context information:\n${context}`
      });
    }
    
    // User query
    messages.push({
      role: 'user',
      content: userQuery
    });
    
    // Generate response
    console.log('RAGService: Generating answer with Ollama...');
    const startTime = Date.now();
    const response = await getOllamaClient().chat({
      model: 'llama3.2:1b',
      messages: messages,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_ctx: 4096,
      }
    });
    const endTime = Date.now();
    console.log(`RAGService: Ollama response received in ${endTime - startTime}ms`);
    
    return {
      answer: response.message.content,
      sources: sources,
      metrics: {
        responseTime: endTime - startTime,
        contextSize: context.length,
        numSources: sources.length
      }
    };
  } catch (error) {
    console.error('RAGService: Error in queryWithContext:', error);
    throw new Error(`Failed to process query: ${error.message}`);
  }
}

/**
 * Stream query results with context from ChromaDB
 * @param {string} userQuery The user's query
 * @param {number} numResults Number of results to fetch from ChromaDB
 * @param {function} onToken Callback for streaming tokens
 * @returns {Promise<object>} The complete response
 */
async function streamQueryWithContext(userQuery, numResults = 3, onToken) {
  try {
    console.log(`RAGService: Processing streaming query: "${userQuery.substring(0, 50)}${userQuery.length > 50 ? '...' : ''}"`);
    
    // Ensure Ollama connection is active
    await ensureOllamaConnection();
    
    // Get the collection
    const collection = await getOrCreateCollection('rag_documents');
    
    // Query for relevant documents
    console.log(`RAGService: Querying ChromaDB for relevant documents...`);
    const queryStartTime = Date.now();
    
    const results = await queryCollection(collection, numResults, [userQuery]);
    const queryEndTime = Date.now();
    console.log(`RAGService: ChromaDB query completed in ${queryEndTime - queryStartTime}ms`);
    
    let context = '';
    let sources = [];
    
    if (results && results.documents && results.documents[0] && results.documents[0].length > 0) {
      console.log(`RAGService: Found ${results.documents[0].length} relevant documents`);
      
      // Format documents from ChromaDB
      context = results.documents[0].join('\n\n');
      
      // Extract sources for citation
      sources = results.metadatas[0].map((metadata, index) => ({
        id: results.ids[0][index],
        title: metadata.source || `Document ${index + 1}`,
        content: results.documents[0][index].substring(0, 100) + '...'
      }));
    } else {
      console.log('RAGService: No relevant documents found in ChromaDB');
    }
    
    // Prepare prompt
    const messages = [];
    
    // System message with instructions
    messages.push({
      role: 'system',
      content: `You are a knowledgeable assistant with access to a specialized database.
      Your task is to answer the user's question using ONLY the information provided in the context below.
      If the context doesn't contain relevant information, acknowledge that you don't know.
      Do not make up information or use your training data to answer.`
    });
    
    // Add context as a separate message if we have it
    if (context) {
      messages.push({
        role: 'system', 
        content: `Context information:\n${context}`
      });
    }
    
    // User query
    messages.push({
      role: 'user',
      content: userQuery
    });
    
    // Generate streaming response
    console.log('RAGService: Generating streaming answer with Ollama...');
    const startTime = Date.now();
    
    let fullResponse = '';
    await getOllamaClient().chat({
      model: 'llama3.2:1b',
      messages: messages,
      stream: true,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_ctx: 4096,
      },
      onComplete: (message) => {
        fullResponse = message;
        if (onToken) onToken({ done: true });
      },
      onStream: ({ message }) => {
        if (onToken) onToken(message.content);
      }
    });
    
    const endTime = Date.now();
    console.log(`RAGService: Ollama streaming completed in ${endTime - startTime}ms`);
    
    return {
      answer: fullResponse,
      sources: sources,
      metrics: {
        responseTime: endTime - startTime,
        contextSize: context.length,
        numSources: sources.length
      }
    };
  } catch (error) {
    console.error('RAGService: Error in streamQueryWithContext:', error);
    throw new Error(`Failed to process streaming query: ${error.message}`);
  }
}

export {
  queryWithContext,
  streamQueryWithContext,
  ensureOllamaConnection
}; 