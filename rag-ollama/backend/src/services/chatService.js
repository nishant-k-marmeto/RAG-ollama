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
    console.log('ChatService: Creating new Ollama client instance with keep-alive settings');
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
    console.log("ChatService: Ollama connection failed, reconnecting...", error.message);
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
  console.log(`ChatService: Warming up model: ${modelName}...`);
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
    
    console.log(`ChatService: ✅ Model ${modelName} warmed up successfully in ${duration}ms`);
    return true;
  } catch (error) {
    console.error(`ChatService: ❌ Failed to warm up model ${modelName}:`, error.message);
    return false;
  }
}

/**
 * Warm up all configured models
 * @returns {Promise<object>} - Results of warmup operations
 */
async function warmupAllModels() {
  console.log(`ChatService: Starting warmup for ${MODELS_TO_WARMUP.length} models...`);
  const results = {};
  
  // Make sure the connection is active
  await ensureOllamaConnection();
  
  // Warm up each model
  for (const model of MODELS_TO_WARMUP) {
    results[model] = await warmupModel(model);
  }
  
  console.log('ChatService: Model warmup completed with results:', results);
  return results;
}

// Perform initial warmup on startup
(async function initialWarmup() {
  try {
    console.log('ChatService: Performing initial model warmup...');
    await warmupAllModels();
  } catch (error) {
    console.error('ChatService: Initial model warmup failed:', error);
  }
})();

// Schedule periodic warmups to keep models loaded
const warmupInterval = setInterval(async () => {
  try {
    console.log('ChatService: Performing scheduled model warmup...');
    await warmupAllModels();
  } catch (error) {
    console.error('ChatService: Scheduled model warmup failed:', error);
  }
}, WARMUP_INTERVAL);

// Handle process termination
process.on('SIGTERM', () => {
  clearInterval(warmupInterval);
  console.log('ChatService: Warmup interval cleared on process termination');
});

// Collection name for ChromaDB
const COLLECTION_NAME = 'rag_documents';

// In-memory conversation storage (in production, use a database)
const conversations = new Map();

/**
 * Create a new conversation or get an existing one
 * @param {string} conversationId - Unique conversation identifier
 * @returns {object} The conversation object
 */
function getConversation(conversationId) {
  if (!conversations.has(conversationId)) {
    conversations.set(conversationId, {
      messages: [],
      created: new Date().toISOString()
    });
  }
  return conversations.get(conversationId);
}

/**
 * Clear a conversation's history
 * @param {string} conversationId - Unique conversation identifier
 * @returns {boolean} Success status
 */
function clearConversation(conversationId) {
  if (conversations.has(conversationId)) {
    const conversation = conversations.get(conversationId);
    conversation.messages = [];
    conversation.lastCleared = new Date().toISOString();
    return true;
  }
  return false;
}

/**
 * Get all conversations (for debugging/admin purposes)
 * @returns {object[]} Array of conversation objects with IDs
 */
function getAllConversations() {
  const result = [];
  conversations.forEach((value, key) => {
    result.push({
      id: key,
      messageCount: value.messages.length,
      created: value.created,
      lastCleared: value.lastCleared
    });
  });
  return result;
}

/**
 * Get a specific conversation history
 * @param {string} conversationId - Unique conversation identifier
 * @returns {object[]} Array of messages in the conversation
 */
function getConversationHistory(conversationId) {
  const conversation = getConversation(conversationId);
  return conversation.messages;
}

/**
 * Chat with context from ChromaDB and maintain conversation history
 * @param {string} conversationId - Unique conversation identifier
 * @param {string} userMessage - The user's message
 * @param {boolean} useChainOfThought - Whether to use chain-of-thought reasoning
 * @returns {object} The response object
 */
async function chatWithContext(conversationId, userMessage, useChainOfThought = false) {
  try {
    console.log('==== CHAT SERVICE START ====');
    console.log(`Conversation ID: ${conversationId}`);
    console.log(`User message: "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}"`);
    console.log(`Chain of thought: ${useChainOfThought}`);
    console.log(`Ollama config: ${JSON.stringify({ 
      host: process.env.OLLAMA_HOST || 'default (localhost:11434)',
      model: 'llama3.2',
      temperature: 0.5,
    })}`);
    
    // Ensure Ollama connection is active
    await ensureOllamaConnection();
    
    // Get the conversation
    const conversation = getConversation(conversationId);
    
    // Add the user message to the conversation
    conversation.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });
    
    // Try to get relevant documents from ChromaDB
    let context = '';
    let relevantDocs = [];
    
    try {
      console.log('Querying ChromaDB for relevant documents...');
      const startQueryTime = Date.now();
      const collection = await getOrCreateCollection(COLLECTION_NAME);
      const results = await queryCollection(collection, 3, [userMessage]);
      const endQueryTime = Date.now();
      console.log(`ChromaDB query completed in ${endQueryTime - startQueryTime}ms`);
      
      if (results.documents && results.documents[0] && results.documents[0].length > 0) {
        console.log(`Found ${results.documents[0].length} relevant documents`);
        // Format documents from ChromaDB
        context = results.documents[0].join('\n\n');
        
        // Map the documents for response
        relevantDocs = results.documents[0].map((doc, index) => ({
          id: results.ids[0][index],
          title: results.metadatas[0][index]?.source || `Document ${index + 1}`,
          content: doc.substring(0, 100) + '...'
        }));
      } else {
        console.log('No relevant documents found in ChromaDB');
      }
    } catch (error) {
      console.error('Error querying ChromaDB:', error);
    }
    
    // Create system message with instructions
    let systemPrompt = `You are a knowledgeable assistant with access to a specialized database.
      When answering questions:
      1. First analyze the context carefully
      2. Cite specific documents when possible
      3. Format responses with bullet points for readability
      4. If uncertain, acknowledge limitations`;
    
    // Add chain-of-thought instructions if enabled
    if (useChainOfThought) {
      systemPrompt += `\n\nIMPORTANT: Use a step-by-step thinking process to solve problems or answer questions. 
First, understand the question. Then, analyze the available information. 
Finally, reason through to the answer, showing your work by prefacing it with "Thinking: ".
After you've worked through your reasoning, provide a clear, concise answer.`;
    }

    // Prepare the messages array for Ollama
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add conversation history (limit to last 10 messages to avoid context overflow)
    const historyMessages = conversation.messages.slice(-10);
    
    // Add context as a separate message if we have it
    if (context) {
      messages.push({
        role: 'system', 
        content: `Context information:\n${context}`
      });
    }
    
    // Add conversation history
    messages.push(...historyMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    })));
    
    console.log(`Prepared ${messages.length} messages for Ollama`);
    console.log('Calling Ollama...');
    
    // Generate the response
    const startOllamaTime = Date.now();
    
    try {
      console.log('Using persistent Ollama client...');
      console.log(`Host: ${JSON.stringify(ollamaClient)}`);
      const response = await getOllamaClient().chat({
        model: 'llama3.2',
        temperature: 0.5,
        messages: messages
      });
      
      const endOllamaTime = Date.now();
      console.log(`Ollama response received in ${endOllamaTime - startOllamaTime}ms`);
      
      // Add the assistant's response to the conversation
      conversation.messages.push({
        role: 'assistant',
        content: response.message.content,
        timestamp: new Date().toISOString()
      });
      
      console.log('==== CHAT SERVICE END ====');
      
      return {
        answer: response.message.content,
        conversation: {
          id: conversationId,
          messageCount: conversation.messages.length
        },
        documents: relevantDocs
      };
    } catch (ollamaError) {
      console.error('Ollama error:', ollamaError);
      console.error('Ollama error details:', ollamaError.stack);
      throw ollamaError;
    }
  } catch (error) {
    console.error('==== CHAT SERVICE ERROR ====');
    console.error('Error in chat with context:', error);
    console.error('Stack trace:', error.stack);
    throw new Error('Failed to generate chat response: ' + error.message);
  }
}

export { 
  chatWithContext, 
  getConversation, 
  clearConversation, 
  getAllConversations,
  getConversationHistory
}; 