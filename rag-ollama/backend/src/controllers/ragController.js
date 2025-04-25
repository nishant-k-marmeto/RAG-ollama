import { getOrCreateCollection, deleteAllDocuments as deleteAllChromaDocuments } from '../utils/chromadb.js';
import { addFilesToCollection } from '../utils/data_loader.js';
import { queryDocuments } from '../services/documentService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

// Collection name for ChromaDB
const COLLECTION_NAME = 'rag_documents';

/**
 * Add a document directly to the knowledge base
 */
export const addDocument = async (req, res) => {
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
    
    // Add to ChromaDB
    try {
      const collection = await getOrCreateCollection(COLLECTION_NAME);
      await collection.add({
        ids: [newDoc.id],
        documents: [newDoc.content],
        metadatas: [{ 
          source: newDoc.title, 
          type: 'manual',
          created: newDoc.createdAt
        }],
      });
      console.log(`Added document to ChromaDB: ${newDoc.title}`);
      
      return res.status(201).json({ message: 'Document added successfully', document: newDoc });
    } catch (error) {
      console.error('Failed to add document to ChromaDB:', error);
      return res.status(500).json({ error: 'Failed to add document to ChromaDB: ' + error.message });
    }
  } catch (error) {
    console.error('Error adding document:', error);
    return res.status(500).json({ error: 'Failed to add document: ' + error.message });
  }
};

/**
 * Search the knowledge base with a semantic query
 */
export const searchDocuments = async (req, res) => {
  try {
    const { query, limit = 5, filters = {} } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'A valid search query is required' });
    }
    
    console.log(`Received search request: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    
    // Set up options for the query
    const options = {
      limit: parseInt(limit, 10),
      filters,
      includeMetadata: true,
      includeDistances: true,
      collectionName: COLLECTION_NAME
    };
    
    // Log request details
    console.log(`Search options: ${JSON.stringify(options)}`);
    
    try {
      // Execute the query
      const results = await queryDocuments(query, options);
      
      // Return formatted results
      return res.status(200).json({
        success: true,
        message: `Found ${results.count} matching documents`,
        ...results
      });
    } catch (error) {
      console.error('Error during document search:', error);
      return res.status(500).json({ 
        error: 'Failed to search documents', 
        message: error.message 
      });
    }
  } catch (error) {
    console.error('Error in search documents endpoint:', error);
    return res.status(500).json({ error: 'Failed to process search request' });
  }
};

/**
 * Delete all documents from the knowledge base
 */
export const deleteAllDocuments = async (req, res) => {
  try {
    // Clear ChromaDB documents
    try {
      const collection = await getOrCreateCollection(COLLECTION_NAME);
      await deleteAllChromaDocuments(collection);
      return res.status(200).json({ message: 'All documents deleted successfully' });
    } catch (error) {
      console.error('Error deleting documents from ChromaDB:', error);
      return res.status(500).json({ error: 'Failed to delete documents: ' + error.message });
    }
  } catch (error) {
    console.error('Error deleting all documents:', error);
    return res.status(500).json({ error: 'Failed to delete all documents: ' + error.message });
  }
};

/**
 * Sync files from utils-data directory to the knowledge base
 */
export const syncUtilsDataFiles = async (req, res) => {
  try {
    // Get directory path
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const utilsDataDir = path.join(__dirname, '../../utils-data');
    
    console.log(`Looking for utils-data directory at: ${utilsDataDir}`);
    
    // Ensure the directory exists
    if (!fs.existsSync(utilsDataDir)) {
      // Try to create the directory if it doesn't exist
      try {
        fs.mkdirSync(utilsDataDir, { recursive: true });
        console.log(`Created utils-data directory at: ${utilsDataDir}`);
      } catch (dirError) {
        console.error(`Failed to create utils-data directory: ${dirError.message}`);
        return res.status(404).json({ 
          error: 'Utils-data directory not found and could not be created',
          path: utilsDataDir 
        });
      }
    }
    
    // Check if directory is empty
    const dirContents = fs.readdirSync(utilsDataDir);
    if (dirContents.length === 0) {
      console.log(`Utils-data directory exists but is empty: ${utilsDataDir}`);
      return res.status(404).json({ 
        error: 'Utils-data directory is empty. Please add files to synchronize.',
        path: utilsDataDir 
      });
    }
    
    console.log(`Found ${dirContents.length} files/folders in utils-data directory`);
    
    // Get the collection
    const collection = await getOrCreateCollection(COLLECTION_NAME);
    
    // Process directory using data_loader's addFilesToCollection
    try {
      const count = await addFilesToCollection(utilsDataDir, collection);
      
      // Format response for detailed feedback
      const filesProcessed = dirContents.filter(file => {
        const filePath = path.join(utilsDataDir, file);
        const fileExt = path.extname(file).toLowerCase();
        return !fs.statSync(filePath).isDirectory() && 
               !file.startsWith('.') && 
               (fileExt === '.txt' || fileExt === '.csv');
      });
      
      return res.status(200).json({
        message: `Successfully processed ${filesProcessed.length} files from utils-data directory using sentence-based chunking`,
        stats: {
          filesProcessed: filesProcessed.length,
          chunksCreated: count
        },
        files: filesProcessed.map(file => ({
          name: file, 
          type: path.extname(file).toLowerCase().substring(1)
        })),
        directoryPath: utilsDataDir
      });
    } catch (error) {
      console.error('Error syncing utils-data files:', error);
      return res.status(500).json({ error: 'Failed to process files: ' + error.message });
    }
  } catch (error) {
    console.error('Error syncing utils-data files:', error);
    return res.status(500).json({ error: 'Failed to sync utils-data files: ' + error.message });
  }
};

/**
 * Check ChromaDB status
 */
export const checkChromaStatus = async (req, res) => {
  try {
    const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
    
    try {
      // Check if ChromaDB is running
      const response = await axios.get(`${CHROMA_URL}/api/v2/heartbeat`);
      
      // Try to get collection info
      const collection = await getOrCreateCollection(COLLECTION_NAME);
      const count = await collection.count();
      
      return res.status(200).json({
        status: 'ok',
        message: 'ChromaDB is running',
        url: CHROMA_URL,
        collection: COLLECTION_NAME,
        documentCount: count
      });
    } catch (error) {
      console.error('ChromaDB check failed:', error.message);
      
      return res.status(503).json({
        status: 'error',
        message: 'ChromaDB is not available',
        error: error.message,
        url: CHROMA_URL
      });
    }
  } catch (error) {
    console.error('Error checking ChromaDB status:', error);
    return res.status(500).json({ error: 'Failed to check ChromaDB status: ' + error.message });
  }
}; 