import express from 'express';
import * as ragController from '../controllers/ragController.js';
import * as chatController from '../controllers/chatController.js';

const router = express.Router();

// Route logging middleware
const logRoute = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} requested from ${req.ip}`);
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  
  // Track response
  const originalSend = res.send;
  res.send = function(body) {
    console.log(`[${new Date().toISOString()}] Response status: ${res.statusCode}`);
    return originalSend.call(this, body);
  };
  
  next();
};

// Apply logging middleware to all routes
router.use(logRoute);

// Document management routes - essential only
router.post('/add-document', ragController.addDocument);
router.post('/sync-utils-data', ragController.syncUtilsDataFiles);
router.delete('/documents', ragController.deleteAllDocuments);

// Search route - new
router.post('/search', ragController.searchDocuments);

// ChromaDB status check - essential
router.get('/chroma-status', ragController.checkChromaStatus);

// Chat routes - keep all
router.post('/chat', chatController.processChatMessage);
router.get('/chat/:conversationId/history', chatController.getChatHistory);
router.delete('/chat/:conversationId', chatController.clearConversation);
router.get('/chat/conversations', chatController.getConversations);

// Clear all data
router.delete('/clear-all-data', chatController.clearAllData);

export default router; 