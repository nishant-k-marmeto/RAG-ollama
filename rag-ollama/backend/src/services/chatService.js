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
    console.log("ChatService: Ollama connection failed, reconnecting...", error.message);
    // Reset client to force new connection
    ollamaClient = null;
    // Try to create new connection
    getOllamaClient();
    return false;
  }
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
    
    // Ensure Ollama connection is active
    await ensureOllamaConnection();
    
    // Format the conversation with just the current message
    const messages = [
      {
        role: 'user',
        content: userMessage
      }
    ];
    
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

    // Add system message to the beginning
    messages.unshift({ role: 'system', content: systemPrompt });
    
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
      
      if (results && results.documents && results.documents[0] && results.documents[0].length > 0) {
        console.log(`Found ${results.documents[0].length} relevant documents`);
        // Format documents from ChromaDB
        context = results.documents[0].join('\n\n');
        
        // Map the documents for response
        relevantDocs = results.documents[0].map((doc, index) => ({
          id: results.ids[0][index],
          title: results.metadatas[0][index]?.source || `Document ${index + 1}`,
          content: doc.substring(0, 100) + '...'
        }));
        
        // Add context as a separate message if we have it
        if (context) {
          messages.splice(1, 0, {
            role: 'system', 
            content: `Context information:\n${context}`
          });
        }
      } else {
        console.log('No relevant documents found in ChromaDB');
      }
    } catch (error) {
      console.error('Error querying ChromaDB:', error);
    }
    
    console.log(`Prepared ${messages.length} messages for Ollama`);
    console.log('Calling Ollama...');
    
    // Generate the response
    const startOllamaTime = Date.now();
    
    try {
      console.log('Using persistent Ollama client...');
      const response = await getOllamaClient().chat({
        model: 'llama3.2',
        temperature: 0.7,
        messages: messages,
        options: {
          top_p: 0.9,
          num_ctx: 4096,
        }
      });
      
      const endOllamaTime = Date.now();
      console.log(`Ollama response received in ${endOllamaTime - startOllamaTime}ms`);
      
      console.log('==== CHAT SERVICE END ====');
      
      return {
        answer: response.message.content,
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
  chatWithContext,
  streamChat,
  ensureOllamaConnection
}; 