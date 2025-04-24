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

// Core RAG routes
router.post('/query', ragController.queryWithContext);
router.get('/query/stream', ragController.streamQueryWithContext);

// Document management routes
router.post('/add-document', ragController.addDocument);
router.post('/upload-files', ragController.uploadFiles);
router.post('/upload-file-content', ragController.uploadFileContent);
router.get('/documents', ragController.getAllDocuments);
router.post('/sync-utils-data', ragController.syncUtilsDataFiles);
router.post('/import-employee-data', ragController.importEmployeeData);
router.delete('/documents', ragController.deleteAllDocuments);

// ChromaDB status check
router.get('/chroma-status', ragController.checkChromaStatus);

// Chat routes
router.post('/chat', chatController.processChatMessage);
router.get('/chat/:conversationId/history', chatController.getChatHistory);
router.delete('/chat/:conversationId', chatController.clearConversation);
router.get('/chat/conversations', chatController.getConversations);

// Clear all data
router.delete('/clear-all-data', chatController.clearAllData);

export default router; 