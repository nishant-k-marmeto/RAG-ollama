import express from 'express';
import * as ragController from '../controllers/ragController.js';
import * as chatController from '../controllers/chatController.js';

const router = express.Router();

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

// Chat routes
router.post('/chat', chatController.processChatMessage);
router.get('/chat/:conversationId/history', chatController.getChatHistory);
router.delete('/chat/:conversationId', chatController.clearConversation);
router.get('/chat/conversations', chatController.getConversations);

// Clear all data
router.delete('/clear-all-data', chatController.clearAllData);

export default router; 