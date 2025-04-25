import { Ollama } from 'ollama';
import { getOrCreateCollection, queryCollection } from '../utils/chromadb.js';

// Global Ollama client instance
let ollamaClient = null;

// Collection name for ChromaDB
const COLLECTION_NAME = 'chat_history';

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
 * Process and generate the chat response using ollama 
 * @param {Array} conversation - The conversation history
 * @returns {Promise<Object>} The response from the LLM
 */
async function processChat(conversation) {
  try {
    console.log('ChatService: Processing chat request');
    
    // Ensure Ollama connection is active
    await ensureOllamaConnection();
    
    // Format the conversation for Ollama
    const messages = conversation.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
    
    // Pre-process to check if this is a RAG query (contain the query_embeddings flag)
    const isRagQuery = messages.length > 0 && 
                       messages[messages.length - 1].role === 'user' && 
                       messages[messages.length - 1].content.includes('query_embeddings:');
    
    let userQuery = '';
    
    // If this is a RAG query, extract the actual query and perform semantic search
    if (isRagQuery) {
      console.log('ChatService: RAG query detected');
      userQuery = messages[messages.length - 1].content.replace('query_embeddings:', '').trim();
      
      // Update the last message to just contain the pure query
      messages[messages.length - 1].content = userQuery;
      
      // Get the collection for embeddings lookup
      const collection = await getOrCreateCollection(COLLECTION_NAME);
      
      // Query for relevant conversation snippets
      console.log(`ChatService: Querying ChromaDB for: "${userQuery.substring(0, 50)}..."`);
      
      // Get collection results directly without caching
      const results = await queryCollection(collection, 3, [userQuery]);
      
      if (results && results.documents && results.documents[0] && results.documents[0].length > 0) {
        console.log(`ChatService: Found ${results.documents[0].length} relevant past conversations`);
        
        // Add the relevant past conversations as context
        const context = results.documents[0].join('\n\n');
        
        // Insert a system message with the context right before the user's message
        messages.splice(messages.length - 1, 0, {
          role: 'system',
          content: `The following are relevant excerpts from past conversations that may help you answer the upcoming question:\n\n${context}\n\nUse this information if relevant to answer the user's next question, but don't mention that you're using past conversation history unless explicitly asked.`
        });
      } else {
        console.log('ChatService: No relevant past conversations found');
      }
    }
    
    // Generate response
    console.log('ChatService: Calling Ollama for chat response');
    const startTime = Date.now();
    const response = await getOllamaClient().chat({
      model: 'llama3.2',
      messages: messages,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_ctx: 4096,
      }
    });
    const endTime = Date.now();
    console.log(`ChatService: Ollama response received in ${endTime - startTime}ms`);
    
    // Return the LLM response
    return {
      message: {
        role: 'assistant',
        content: response.message.content
      },
      metrics: {
        responseTime: endTime - startTime
      }
    };
  } catch (error) {
    console.error('ChatService: Error processing chat:', error);
    throw new Error(`Failed to process chat: ${error.message}`);
  }
}

/**
 * Process and generate a streaming chat response
 * @param {Array} conversation - The conversation history
 * @param {Function} onToken - Callback for token streaming
 * @returns {Promise<Object>} The complete response
 */
async function streamChat(conversation, onToken) {
  try {
    console.log('ChatService: Processing streaming chat request');
    
    // Ensure Ollama connection is active
    await ensureOllamaConnection();
    
    // Format the conversation for Ollama
    const messages = conversation.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
    
    // Pre-process to check if this is a RAG query
    const isRagQuery = messages.length > 0 && 
                       messages[messages.length - 1].role === 'user' && 
                       messages[messages.length - 1].content.includes('query_embeddings:');
    
    let userQuery = '';
    
    // If this is a RAG query, extract the actual query and perform semantic search
    if (isRagQuery) {
      console.log('ChatService: RAG query detected for streaming');
      userQuery = messages[messages.length - 1].content.replace('query_embeddings:', '').trim();
      
      // Update the last message to just contain the pure query
      messages[messages.length - 1].content = userQuery;
      
      // Get the collection for embeddings lookup
      const collection = await getOrCreateCollection(COLLECTION_NAME);
      
      // Query for relevant conversation snippets
      console.log(`ChatService: Querying ChromaDB for: "${userQuery.substring(0, 50)}..."`);
      
      // Get collection results directly without caching
      const results = await queryCollection(collection, 3, [userQuery]);
      
      if (results && results.documents && results.documents[0] && results.documents[0].length > 0) {
        console.log(`ChatService: Found ${results.documents[0].length} relevant past conversations`);
        
        // Add the relevant past conversations as context
        const context = results.documents[0].join('\n\n');
        
        // Insert a system message with the context right before the user's message
        messages.splice(messages.length - 1, 0, {
          role: 'system',
          content: `The following are relevant excerpts from past conversations that may help you answer the upcoming question:\n\n${context}\n\nUse this information if relevant to answer the user's next question, but don't mention that you're using past conversation history unless explicitly asked.`
        });
      } else {
        console.log('ChatService: No relevant past conversations found');
      }
    }
    
    // Generate streaming response
    console.log('ChatService: Calling Ollama for streaming chat response');
    const startTime = Date.now();
    
    let fullResponse = '';
    await getOllamaClient().chat({
      model: 'llama3.2',
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
    console.log(`ChatService: Ollama streaming completed in ${endTime - startTime}ms`);
    
    // Return the full message when streaming is complete
    return {
      message: {
        role: 'assistant',
        content: fullResponse
      },
      metrics: {
        responseTime: endTime - startTime
      }
    };
  } catch (error) {
    console.error('ChatService: Error processing streaming chat:', error);
    throw new Error(`Failed to process streaming chat: ${error.message}`);
  }
}

export {
  processChat,
  streamChat,
  ensureOllamaConnection
}; 