import { Ollama } from 'ollama';
import { getOrCreateCollection, queryCollection } from '../utils/chromadb.js';

// Global Ollama client reference
let ollamaClient = null;

// Model warmup configuration
const MODELS_TO_WARMUP = ['llama3.2']; // Add more models as needed
const WARMUP_INTERVAL = 15 * 60 * 1000; // 15 minutes
const WARMUP_SCENARIOS = [
  { role: 'user', content: 'Hello, how are you?' },
  { role: 'user', content: 'What is machine learning?' },
  { role: 'user', content: 'Summarize this document for me' }
];

/**
 * Get or create an Ollama client with connection pooling
 * @returns {Ollama} The Ollama client instance
 */
function getOllamaClient() {
  if (!ollamaClient) {
    console.log('Creating new Ollama client instance with keep-alive settings');
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
    console.log("Ollama connection failed, reconnecting...", error.message);
    // Reset client to force new connection
    ollamaClient = null;
    // Try to create new connection
    getOllamaClient();
    return false;
  }
}

/**
 * Warm up a specific model with various prompts
 * @param {string} modelName - Name of the model to warm up
 * @returns {Promise<boolean>} - Success status
 */
async function warmupModel(modelName) {
  console.log(`Warming up model: ${modelName}...`);
  try {
    // Pick a random scenario from the warmup scenarios
    const scenario = WARMUP_SCENARIOS[Math.floor(Math.random() * WARMUP_SCENARIOS.length)];
    
    // Send the warmup prompt to the model
    const startTime = Date.now();
    await getOllamaClient().chat({
      model: modelName,
      messages: [scenario]
    });
    const duration = Date.now() - startTime;
    
    console.log(`✅ Model ${modelName} warmed up successfully in ${duration}ms`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to warm up model ${modelName}:`, error.message);
    return false;
  }
}

/**
 * Warm up all configured models
 * @returns {Promise<object>} - Results of warmup operations
 */
async function warmupAllModels() {
  console.log(`Starting warmup for ${MODELS_TO_WARMUP.length} models...`);
  const results = {};
  
  // Make sure the connection is active
  await ensureOllamaConnection();
  
  // Warm up each model
  for (const model of MODELS_TO_WARMUP) {
    results[model] = await warmupModel(model);
  }
  
  console.log('Model warmup completed with results:', results);
  return results;
}

// Perform initial warmup on startup
(async function initialWarmup() {
  try {
    console.log('Performing initial model warmup...');
    await warmupAllModels();
  } catch (error) {
    console.error('Initial model warmup failed:', error);
  }
})();

// Schedule periodic warmups to keep models loaded
const warmupInterval = setInterval(async () => {
  try {
    console.log('Performing scheduled model warmup...');
    await warmupAllModels();
  } catch (error) {
    console.error('Scheduled model warmup failed:', error);
  }
}, WARMUP_INTERVAL);

// Handle process termination
process.on('SIGTERM', () => {
  clearInterval(warmupInterval);
  console.log('Warmup interval cleared on process termination');
});

// Collection name for ChromaDB
const COLLECTION_NAME = 'rag_documents';
/**
 * Simple document similarity search for retrieval
 * In a real application, you would use a proper vector DB
 */
const findRelevantDocuments = (query, documents) => {
  if (!documents.length) return [];
  
  // Simple keyword matching (not ideal, but works for demo)
  const keywords = query.toLowerCase().split(' ');
  
  return documents
    .map(doc => {
      const content = doc.content.toLowerCase();
      const title = doc.title.toLowerCase();
      
      // Calculate a simple relevance score
      const score = keywords.reduce((acc, keyword) => {
        return acc + 
          (content.includes(keyword) ? 1 : 0) + 
          (title.includes(keyword) ? 0.5 : 0);
      }, 0);
      
      return { ...doc, score };
    })
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // Return top 3 most relevant docs
};

/**
 * Generate a response using RAG (Retrieval Augmented Generation)
 * @param {string} query - User query
 * @param {Array} documents - Legacy documents (used as fallback)
 * @returns {Object} - Response with answer and documents used
 */
const generateResponse = async (query, documents) => {
  try {
    // Ensure Ollama connection is working
    await ensureOllamaConnection();
    
    // Try to get relevant documents from ChromaDB
    let relevantDocs = [];
    let useChroma = false;
    let context = '';
    
    try {
      const collection = await getOrCreateCollection(COLLECTION_NAME);
      const results = await queryCollection(collection, 3, [query]);
      
      if (results.documents && results.documents[0] && results.documents[0].length > 0) {
        useChroma = true;
        // Format documents from ChromaDB
        context = results.documents[0].join('\n\n');
        
        // Map the documents for response
        relevantDocs = results.documents[0].map((doc, index) => ({
          id: results.ids[0][index],
          title: results.metadatas[0][index]?.source || `Document ${index + 1}`,
          content: doc.substring(0, 100) + '...' // Just to keep the response lighter
        }));
      }
    } catch (error) {
      console.error('Error querying ChromaDB:', error);
      // Fall back to the legacy method
      useChroma = false;
    }
    
    // If ChromaDB failed or had no results, fall back to the legacy method
    if (!useChroma) {
      console.log('Falling back to legacy document retrieval');
      // Use the legacy document finding method
      relevantDocs = findRelevantDocuments(query, documents);
      
      if (relevantDocs.length === 0) {
        const response = await getOllamaClient().chat({
          model: 'llama3.2',
          temperature: 0.5, 
          messages: [{ role: 'user', content: query }],
        });
        
        return {
          answer: response.message.content,
          documents: []
        };
      }
      
      // Format documents as context
      context = relevantDocs.map(doc => 
        `SOURCE: ${doc.title} (${doc.id})
         CONTENT: ${doc.content}
         RELEVANCE: ${doc.score}
        `).join('\n\n');
    }

    // Create a prompt with the context
    const systemPrompt = `You are a knowledgeable assistant with access to a specialized database.
      When answering questions:
      1. First analyze the context carefully
      2. Cite specific documents when possible
      3. Format responses with bullet points for readability
      4. If uncertain, acknowledge limitations`;

    const userPrompt = `Context:
${context}

Question: ${query}`;

    // Generate the response using ollama with persistent connection
    const response = await getOllamaClient().chat({
      model: 'llama3.2',
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });
    
    return {
      answer: response.message.content,
      documents: relevantDocs.map(doc => {
        if (typeof doc.id !== 'undefined') {
          return { id: doc.id, title: doc.title };
        }
        return doc;
      })
    };
  } catch (error) {
    console.error('Error generating RAG response:', error);
    throw new Error('Failed to generate response: ' + error.message);
  }
};

/**
 * Generate a streaming response using RAG
 * @param {string} query - User query
 * @param {Array} documents - Legacy documents (used as fallback)
 * @param {Function} onChunk - Callback for each chunk received
 * @returns {Array} - Info about documents used
 */
const streamGenerateResponse = async (query, documents, onChunk) => {
  try {
    // Ensure Ollama connection is working
    await ensureOllamaConnection();
    
    // Try to get relevant documents from ChromaDB
    let relevantDocs = [];
    let useChroma = false;
    let context = '';
    
    try {
      const collection = await getOrCreateCollection(COLLECTION_NAME);
      const results = await queryCollection(collection, 3, [query]);
      
      if (results.documents && results.documents[0] && results.documents[0].length > 0) {
        useChroma = true;
        // Format documents from ChromaDB
        context = results.documents[0].join('\n\n');
        
        // Map the documents for response
        relevantDocs = results.documents[0].map((doc, index) => ({
          id: results.ids[0][index],
          title: results.metadatas[0][index]?.source || `Document ${index + 1}`,
          content: doc.substring(0, 100) + '...' // Just to keep the response lighter
        }));
      }
    } catch (error) {
      console.error('Error querying ChromaDB:', error);
      // Fall back to the legacy method
      useChroma = false;
    }
    
    // If ChromaDB failed or had no results, fall back to the legacy method
    if (!useChroma) {
      console.log('Falling back to legacy document retrieval');
      // Use the legacy document finding method
      relevantDocs = findRelevantDocuments(query, documents);
      
      if (relevantDocs.length === 0) {
        const response = await getOllamaClient().chat({
          model: 'llama3.2',
          temperature: 0.5,
          messages: [{ role: 'user', content: query }],
          stream: true
        });
        
        for await (const part of response) {
          onChunk(part.message.content);
        }
        
        return [];
      }
      
      // Format documents as context
      context = relevantDocs.map(doc => 
        `SOURCE: ${doc.title} (${doc.id})
         CONTENT: ${doc.content}
         RELEVANCE: ${doc.score}
        `).join('\n\n');
    }
    
    // Create a prompt with the context
    const systemPrompt = `You are a helpful AI assistant. Use the following context to answer the question. Please answer in elaborative manner and always use bullets and points when answering questions.
    If the answer is not in the context, just say "I don't have enough information to answer this question" and suggest what other information would be helpful.`;

    const userPrompt = `Context:
${context}

Question: ${query}`;

    // Generate the streaming response using persistent ollama connection
    const response = await getOllamaClient().chat({
      model: 'llama3.2',
      temperature: 0.5, 
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: true
    });
    
    for await (const part of response) {
      onChunk(part.message.content);
    }
    
    return relevantDocs.map(doc => {
      if (typeof doc.id !== 'undefined') {
        return { id: doc.id, title: doc.title };
      }
      return doc;
    });
  } catch (error) {
    console.error('Error generating streaming RAG response:', error);
    throw new Error('Failed to generate streaming response: ' + error.message);
  }
};

export { generateResponse, streamGenerateResponse }; 