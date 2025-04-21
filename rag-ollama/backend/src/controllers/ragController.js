const ragService = require('../services/ragService');

// In-memory document store for demo purposes
// In a real application, you'd use a database
const documents = [];

/**
 * Query the LLM with relevant context from documents
 */
const queryWithContext = async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Get response from the RAG service
    const response = await ragService.generateResponse(query, documents);
    
    return res.status(200).json({ response });
  } catch (error) {
    console.error('Error in RAG query:', error);
    return res.status(500).json({ error: 'Failed to process query' });
  }
};

/**
 * Query the LLM with relevant context from documents and stream the response
 */
const streamQueryWithContext = async (req, res) => {
  try {
    const query = req.query.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Generate and stream the response
    const docsInfo = await ragService.streamGenerateResponse(query, documents, (chunk) => {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });
    
    // Send the list of documents used at the end
    res.write(`data: ${JSON.stringify({ documents: docsInfo, done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Error in streaming RAG query:', error);
    res.write(`data: ${JSON.stringify({ error: 'Error generating response' })}\n\n`);
    res.end();
  }
};

/**
 * Add a document to the knowledge base
 */
const addDocument = async (req, res) => {
  try {
    const { title, content } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }
    
    const newDoc = {
      id: Date.now().toString(),
      title,
      content,
      createdAt: new Date().toISOString()
    };
    
    documents.push(newDoc);
    
    return res.status(201).json({ message: 'Document added successfully', document: newDoc });
  } catch (error) {
    console.error('Error adding document:', error);
    return res.status(500).json({ error: 'Failed to add document' });
  }
};

/**
 * Retrieve all documents in the knowledge base
 */
const getAllDocuments = (req, res) => {
  try {
    return res.status(200).json({ documents });
  } catch (error) {
    console.error('Error getting documents:', error);
    return res.status(500).json({ error: 'Failed to retrieve documents' });
  }
};

module.exports = {
  queryWithContext,
  streamQueryWithContext,
  addDocument,
  getAllDocuments
}; 