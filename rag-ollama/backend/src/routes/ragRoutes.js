const express = require('express');
const ragController = require('../controllers/ragController');

const router = express.Router();

// RAG endpoint to query the model with context
router.post('/query', ragController.queryWithContext);

// RAG endpoint to query the model with streaming response
router.get('/query/stream', ragController.streamQueryWithContext);

// Endpoint to add documents to the knowledge base
router.post('/add-document', ragController.addDocument);

// Get all documents in the knowledge base
router.get('/documents', ragController.getAllDocuments);

module.exports = router; 