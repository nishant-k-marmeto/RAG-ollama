import { Ollama } from 'ollama';
import { getOrCreateCollection, queryCollection } from '../utils/chromadb.js';

// Initialize Ollama client
const ollama = new Ollama();

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
      model: 'llama3.2'
    })}`);
    
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
    let systemPrompt = `You are a helpful AI assistant with access to a knowledge base. 
Use the following context information to answer the question. Please answer in an elaborative way and always use bullets and points when appropriate.
If the answer is not in the context information, just say "I don't have enough information to answer this question" and suggest what other information would be helpful.`;
    
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
      console.log('Initializing Ollama client...');
      console.log(`Host: ${JSON.stringify(ollama)}`);
      const response = await ollama.chat({
        model: 'llama3.2',
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