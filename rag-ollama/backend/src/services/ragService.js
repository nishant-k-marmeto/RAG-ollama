import { Ollama } from 'ollama';
import { getOrCreateCollection, queryCollection } from '../utils/chromadb.js';

// Global reference for the Ollama client
let ollamaClient = null;

// Model warmup configuration
const MODELS_TO_WARMUP = ['llama3.2:1b']; // Add more models as needed
const WARMUP_INTERVAL = 15 * 60 * 1000; // 15 minutes

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
      headers: { 'Connection': 'keep-alive' },
      options: {
        num_gpu: 1, // Enable GPU if available
        numa: true  // NUMA optimization for multi-socket systems
      }
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
 * Enhanced warmup with batch loading and model pinning
 * @param {string} modelName - Name of the model to warm up
 * @returns {Promise<boolean>} - Success status
 */
async function warmupModel(modelName) {
  console.log(`RAGService: Warming up model: ${modelName} with enhanced methodology...`);
  try {
    const startTime = Date.now();
    
    // Batch prompts for comprehensive warmup
    const batchPrompts = [
      // Short prompt to initialize model
      { role: 'user', content: '1+1=' },
      // Memory utilization prompt
      { role: 'user', content: 'Repeat "model warmup" 10 times' },
      // Translate prompt
      { role: 'user', content: 'Translate "hello" to Spanish' },
      // Capital city prompt
      { role: 'user', content: 'What is the capital of France?' }
    ];
    
    // Step 1: Force model weights loading with minimal generation
    console.log(`RAGService: ${modelName}: Loading model weights...`);
    await getOllamaClient().generate({
      model: modelName,
      prompt: '',
      options: { num_predict: 1 }
    });
    
    // Step 2: Batch inference to prime cache and initialize tensors
    console.log(`RAGService: ${modelName}: Running batch inference...`);
    await Promise.all(batchPrompts.map(prompt => 
      getOllamaClient().chat({ 
        model: modelName, 
        messages: [prompt],
        options: { num_ctx: 2048 } 
      })
    ));
    
    // Step 3: Add quantization-aware prompt with varied token lengths
    console.log(`RAGService: ${modelName}: Adding quantization-aware prompt...`);
    await getOllamaClient().generate({
      model: modelName,
      prompt: 'This is a longer prompt to ensure quantization-aware loading across different sequence lengths',
      options: { num_predict: 20 }
    });
    
    // Step 4: Keep model pinned in memory indefinitely
    console.log(`RAGService: ${modelName}: Pinning model in memory...`);
    await getOllamaClient().generate({
      model: modelName,
      prompt: '',
      options: {
        keep_alive: -1 // Indefinite retention (never unload)
      }
    });
    
    const duration = Date.now() - startTime;
    console.log(`RAGService: ✅ Model ${modelName} warmed up successfully in ${duration}ms`);
    return true;
  } catch (error) {
    console.error(`RAGService: ❌ Failed to warm up model ${modelName}:`, error.message);
    return false;
  }
}

/**
 * Warm up all configured models
 * @returns {Promise<object>} - Results of warmup operations
 */
async function warmupAllModels() {
  console.log(`RAGService: Starting warmup for ${MODELS_TO_WARMUP.length} models...`);
  const results = {};
  
  // Make sure the connection is active
  await ensureOllamaConnection();
  
  // Warm up each model
  for (const model of MODELS_TO_WARMUP) {
    results[model] = await warmupModel(model);
  }
  
  console.log('RAGService: Model warmup completed with results:', results);
  return results;
}

// Perform initial warmup on startup
(async function initialWarmup() {
  try {
    console.log('RAGService: Performing initial model warmup...');
    await warmupAllModels();
  } catch (error) {
    console.error('RAGService: Initial model warmup failed:', error);
  }
})();

// Schedule periodic warmups to keep models loaded
const warmupInterval = setInterval(async () => {
  try {
    console.log('RAGService: Performing scheduled model warmup...');
    await warmupAllModels();
  } catch (error) {
    console.error('RAGService: Scheduled model warmup failed:', error);
  }
}, WARMUP_INTERVAL);

// Handle process termination
process.on('SIGTERM', () => {
  clearInterval(warmupInterval);
  console.log('RAGService: Warmup interval cleared on process termination');
});

/**
 * Generate a response using RAG (Retrieval Augmented Generation)
 * @param {string} query - User query
 * @param {Array} documents - Legacy documents (used as fallback)
 * @returns {Object} - Response with answer and documents used
 */
async function generateResponse(query, documents) {
  try {
    console.log(`RAGService: Generating response for query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    
    // Use the queryWithContext function for implementation
    const result = await queryWithContext(query);
    
    return {
      answer: result.answer,
      documents: result.sources
    };
  } catch (error) {
    console.error('RAGService: Error generating response:', error);
    throw new Error('Failed to generate response: ' + error.message);
  }
}

/**
 * Generate a streaming response using RAG
 * @param {string} query - User query
 * @param {Array} documents - Legacy documents (used as fallback)
 * @param {Function} onChunk - Callback for each chunk received
 * @returns {Array} - Info about documents used
 */
async function streamGenerateResponse(query, documents, onChunk) {
  try {
    console.log(`RAGService: Generating streaming response for query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    
    // Use streamQueryWithContext implementation
    const result = await streamQueryWithContext(query, 3, onChunk);
    
    return result.sources;
  } catch (error) {
    console.error('RAGService: Error generating streaming response:', error);
    throw new Error('Failed to generate streaming response: ' + error.message);
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
    
    // Query for relevant documents with optimized parameters
    console.log(`RAGService: Querying ChromaDB for relevant documents...`);
    const queryStartTime = Date.now();
    
    // Enhanced query options for better results
    const queryOptions = {
      // Enable Maximum Marginal Relevance for diverse results
      mmr: {
        enabled: true,
        diversityBias: 0.3
      },
      // Filter options can be added here if needed
      // where: { type: { $in: ['manual', 'text'] } },
    };
    
    const results = await queryCollection(collection, numResults, [userQuery], queryOptions);
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
        content: results.documents[0][index].substring(0, 100) + '...',
        // Include distance score if available
        relevance: results.distances && results.distances[0] ? 
          `${(1 - results.distances[0][index]) * 100}%` : undefined
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
    
    // Query for relevant documents with optimized parameters
    console.log(`RAGService: Querying ChromaDB for relevant documents...`);
    const queryStartTime = Date.now();
    
    // Enhanced query options for better results
    const queryOptions = {
      // Enable Maximum Marginal Relevance for diverse results
      mmr: {
        enabled: true,
        diversityBias: 0.3
      },
      // Filter options can be added here if needed
    };
    
    const results = await queryCollection(collection, numResults, [userQuery], queryOptions);
    const queryEndTime = Date.now();
    console.log(`RAGService: ChromaDB query completed in ${queryEndTime - queryStartTime}ms`);
    
    let context = '';
    let sources = [];
    
    if (results && results.documents && results.documents[0] && results.documents[0].length > 0) {
      console.log(`RAGService: Found ${results.documents[0].length} relevant documents`);
      
      // Format documents from ChromaDB with improved relevance scoring
      context = results.documents[0].join('\n\n');
      
      // Extract sources for citation with relevance info
      sources = results.metadatas[0].map((metadata, index) => ({
        id: results.ids[0][index],
        title: metadata.source || `Document ${index + 1}`,
        content: results.documents[0][index].substring(0, 100) + '...',
        // Include distance score if available
        relevance: results.distances && results.distances[0] ? 
          `${(1 - results.distances[0][index]) * 100}%` : undefined
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
        if (onToken) onToken({ token: message.content, done: false });
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
  ensureOllamaConnection,
  warmupAllModels,
  generateResponse,
  streamGenerateResponse
}; 