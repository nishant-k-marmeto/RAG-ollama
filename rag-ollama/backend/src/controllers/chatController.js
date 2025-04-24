import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { chatWithContext } from '../services/chatService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to store conversation history
const CONVERSATIONS_DIR = path.join(__dirname, '../../data/conversations');

// Ensure conversations directory exists
if (!fs.existsSync(CONVERSATIONS_DIR)) {
  fs.mkdirSync(CONVERSATIONS_DIR, { recursive: true });
}

/**
 * Creates a chat message and stores it in the conversation history
 * DEPRECATED: Use processChatMessage instead
 */
export const createChatMessage = async (req, res) => {
  try {
    const { message, conversationId = uuidv4(), isUserMessage = true } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const conversationPath = path.join(CONVERSATIONS_DIR, `${conversationId}.json`);
    
    // Initialize or load existing conversation
    let conversation = [];
    if (fs.existsSync(conversationPath)) {
      const data = fs.readFileSync(conversationPath, 'utf8');
      conversation = JSON.parse(data);
    }
    
    // Add new message to conversation
    const newMessage = {
      id: uuidv4(),
      content: message,
      timestamp: new Date().toISOString(),
      role: isUserMessage ? 'user' : 'assistant'
    };
    
    conversation.push(newMessage);
    
    // Save conversation to file
    fs.writeFileSync(conversationPath, JSON.stringify(conversation, null, 2));
    
    return res.status(200).json({
      success: true,
      message: 'Message added to conversation',
      conversationId,
      messageId: newMessage.id
    });
  } catch (error) {
    console.error('Error creating chat message:', error);
    return res.status(500).json({ error: 'Failed to create chat message' });
  }
};

/**
 * Processes a chat message, generates an AI response, and saves the conversation
 */
export const processChatMessage = async (req, res) => {
  try {
    console.log('==== CHAT MESSAGE PROCESSING START ====');
    console.log('Request body:', req.body);
    console.log('Request headers:', req.headers);
    console.log('Request URL:', req.protocol + '://' + req.get('host') + req.originalUrl);
    
    const { message, conversationId = uuidv4(), useChainOfThought = false } = req.body;
    
    if (!message) {
      console.log('Error: Message is required');
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`Processing chat for conversation: ${conversationId}`);
    console.log(`Message content: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
    console.log(`Chain of thought enabled: ${useChainOfThought}`);

    // Get AI response using the chat service
    console.log('Calling chat service...');
    const startTime = Date.now();
    const response = await chatWithContext(conversationId, message, useChainOfThought);
    const endTime = Date.now();
    console.log(`Chat service response received in ${endTime - startTime}ms`);
    
    // Save both the user message and AI response to the file system
    const conversationPath = path.join(CONVERSATIONS_DIR, `${conversationId}.json`);
    
    // Initialize or load existing conversation
    let conversation = [];
    if (fs.existsSync(conversationPath)) {
      const data = fs.readFileSync(conversationPath, 'utf8');
      conversation = JSON.parse(data);
    }
    
    // Add user message to conversation
    const userMessage = {
      id: uuidv4(),
      content: message,
      timestamp: new Date().toISOString(),
      role: 'user'
    };
    
    // Add AI response to conversation
    const aiMessage = {
      id: uuidv4(),
      content: response.answer,
      timestamp: new Date().toISOString(),
      role: 'assistant',
      documents: response.documents || []
    };
    
    conversation.push(userMessage, aiMessage);
    
    // Save conversation to file
    fs.writeFileSync(conversationPath, JSON.stringify(conversation, null, 2));
    
    console.log('Chat processing complete - sending response');
    console.log('==== CHAT MESSAGE PROCESSING END ====');
    
    return res.status(200).json({
      success: true,
      answer: response.answer,
      documents: response.documents || [],
      conversationId,
      messageId: aiMessage.id
    });
  } catch (error) {
    console.error('==== CHAT MESSAGE PROCESSING ERROR ====');
    console.error('Error processing chat message:', error);
    console.error('Stack trace:', error.stack);
    return res.status(500).json({ error: 'Failed to process chat message: ' + error.message });
  }
};

/**
 * Retrieves the history of a specific conversation
 */
export const getChatHistory = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }
    
    const conversationPath = path.join(CONVERSATIONS_DIR, `${conversationId}.json`);
    
    if (!fs.existsSync(conversationPath)) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const data = fs.readFileSync(conversationPath, 'utf8');
    const conversation = JSON.parse(data);
    
    return res.status(200).json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('Error retrieving chat history:', error);
    return res.status(500).json({ error: 'Failed to retrieve chat history' });
  }
};

/**
 * Clears a specific conversation
 */
export const clearConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }
    
    const conversationPath = path.join(CONVERSATIONS_DIR, `${conversationId}.json`);
    
    if (!fs.existsSync(conversationPath)) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    fs.unlinkSync(conversationPath);
    
    return res.status(200).json({
      success: true,
      message: 'Conversation cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing conversation:', error);
    return res.status(500).json({ error: 'Failed to clear conversation' });
  }
};

/**
 * Retrieves a list of all conversations
 */
export const getConversations = async (req, res) => {
  try {
    if (!fs.existsSync(CONVERSATIONS_DIR)) {
      return res.status(200).json({ conversations: [] });
    }
    
    const files = fs.readdirSync(CONVERSATIONS_DIR);
    const conversations = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const conversationId = file.replace('.json', '');
        const conversationPath = path.join(CONVERSATIONS_DIR, file);
        const data = fs.readFileSync(conversationPath, 'utf8');
        const messages = JSON.parse(data);
        
        let title = "New Conversation";
        // Use the first user message as the title if it exists
        const firstUserMessage = messages.find(m => m.role === 'user');
        if (firstUserMessage) {
          title = firstUserMessage.content.length > 30 
            ? `${firstUserMessage.content.substring(0, 30)}...` 
            : firstUserMessage.content;
        }
        
        conversations.push({
          id: conversationId,
          title,
          messageCount: messages.length,
          lastUpdated: messages.length > 0 
            ? messages[messages.length - 1].timestamp 
            : null
        });
      }
    }
    
    // Sort by most recent
    conversations.sort((a, b) => {
      if (!a.lastUpdated) return 1;
      if (!b.lastUpdated) return -1;
      return new Date(b.lastUpdated) - new Date(a.lastUpdated);
    });
    
    return res.status(200).json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Error retrieving conversations:', error);
    return res.status(500).json({ error: 'Failed to retrieve conversations' });
  }
};

/**
 * Clears all data (conversations)
 */
export const clearAllData = async (req, res) => {
  try {
    if (!fs.existsSync(CONVERSATIONS_DIR)) {
      return res.status(200).json({ 
        success: true,
        message: 'No data to clear' 
      });
    }
    
    const files = fs.readdirSync(CONVERSATIONS_DIR);
    
    for (const file of files) {
      const filePath = path.join(CONVERSATIONS_DIR, file);
      fs.unlinkSync(filePath);
    }
    
    return res.status(200).json({
      success: true,
      message: 'All data cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing all data:', error);
    return res.status(500).json({ error: 'Failed to clear all data' });
  }
}; 