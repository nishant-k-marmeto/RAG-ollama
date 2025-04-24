import * as ragService from '../services/ragService.js';
import { getOrCreateCollection, deleteAllDocuments as deleteAllChromaDocuments } from '../utils/chromadb.js';
import { addFilesToCollection } from '../utils/data_loader.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import axios from 'axios';

// Collection name for ChromaDB
const COLLECTION_NAME = 'rag_documents';

// In-memory document store for fallback
const documents = [];

/**
 * Query the LLM with relevant context from documents
 */
export const queryWithContext = async (req, res) => {
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
    return res.status(500).json({ error: 'Failed to process query: ' + error.message });
  }
};

/**
 * Query the LLM with relevant context from documents and stream the response
 */
export const streamQueryWithContext = async (req, res) => {
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
    res.write(`data: ${JSON.stringify({ error: 'Error generating response: ' + error.message })}\n\n`);
    res.end();
  }
};

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
    
    // Add to in-memory store (fallback)
    documents.push(newDoc);
    
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
    } catch (error) {
      console.error('Failed to add document to ChromaDB:', error);
      // Continue with in-memory fallback
    }
    
    return res.status(201).json({ message: 'Document added successfully', document: newDoc });
  } catch (error) {
    console.error('Error adding document:', error);
    return res.status(500).json({ error: 'Failed to add document: ' + error.message });
  }
};

/**
 * Upload files (PDFs, CSVs) to the knowledge base
 */
export const uploadFiles = async (req, res) => {
  try {
    const { directory } = req.body;
    
    if (!directory) {
      return res.status(400).json({ error: 'Directory path is required' });
    }
    
    // Ensure the directory exists
    if (!fs.existsSync(directory)) {
      return res.status(400).json({ error: 'Directory does not exist' });
    }
    
    try {
      const collection = await getOrCreateCollection(COLLECTION_NAME);
      const count = await addFilesToCollection(directory, collection);
      
      return res.status(200).json({ 
        message: `Successfully added ${count} files to the knowledge base`,
        count
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      return res.status(500).json({ error: 'Failed to process files: ' + error.message });
    }
  } catch (error) {
    console.error('Error handling file upload:', error);
    return res.status(500).json({ error: 'Failed to upload files: ' + error.message });
  }
};

/**
 * Retrieve all documents in the knowledge base
 */
export const getAllDocuments = async (req, res) => {
  try {
    // Try to get documents from ChromaDB
    try {
      const collection = await getOrCreateCollection(COLLECTION_NAME);
      const result = await collection.get();
      
      if (result && result.ids && result.ids.length > 0) {
        const chromaDocuments = result.ids.map((id, index) => ({
          id,
          title: result.metadatas[index]?.source || `Document ${index + 1}`,
          content: result.documents[index].substring(0, 150) + '...',
          createdAt: result.metadatas[index]?.created || new Date().toISOString()
        }));
        
        return res.status(200).json({ documents: chromaDocuments });
      }
    } catch (error) {
      console.error('Error getting documents from ChromaDB:', error);
      // Fall back to in-memory documents
    }
    
    return res.status(200).json({ documents });
  } catch (error) {
    console.error('Error getting documents:', error);
    return res.status(500).json({ error: 'Failed to retrieve documents: ' + error.message });
  }
};

/**
 * Delete all documents from the knowledge base
 */
export const deleteAllDocuments = async (req, res) => {
  try {
    // Clear in-memory documents
    documents.length = 0;
    
    // Clear ChromaDB documents
    try {
      const collection = await getOrCreateCollection(COLLECTION_NAME);
      await deleteAllChromaDocuments(collection);
      
      return res.status(200).json({ 
        success: true, 
        message: 'All documents deleted successfully from the knowledge base'
      });
    } catch (error) {
      console.error('Error deleting documents from ChromaDB:', error);
      return res.status(500).json({ error: 'Failed to delete documents from ChromaDB: ' + error.message });
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
    
    // Ensure the directory exists
    if (!fs.existsSync(utilsDataDir)) {
      return res.status(404).json({ error: 'Utils-data directory not found' });
    }
    
    // Get the collection
    const collection = await getOrCreateCollection(COLLECTION_NAME);
    
    // Get list of files
    const files = fs.readdirSync(utilsDataDir);
    const processedFiles = [];
    let totalChunks = 0;
    
    // Process each file
    for (const file of files) {
      const filePath = path.join(utilsDataDir, file);
      const fileStats = fs.statSync(filePath);
      
      // Skip directories
      if (fileStats.isDirectory()) continue;
      
      const fileExt = path.extname(file).toLowerCase();
      const fileName = path.basename(file);
      const fileId = `utils-data-${fileName.replace(/\s+/g, '-')}`;
      
      // Process based on file type
      if (fileExt === '.csv') {
        // Process CSV file
        console.log(`Processing CSV file: ${fileName}`);
        const rows = [];
        await new Promise((resolve, reject) => {
          fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => rows.push(row))
            .on('end', () => resolve())
            .on('error', reject);
        });
        
        // Convert to string representation
        const content = rows.map(row => {
          return Object.entries(row)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
        }).join('\n');
        
        // Add to collection
        await collection.add({
          ids: [fileId],
          documents: [content],
          metadatas: [{ 
            source: fileName, 
            type: 'csv',
            created: new Date().toISOString(),
            size: fileStats.size
          }],
        });
        
        processedFiles.push({ name: fileName, type: 'csv', chunks: 1 });
        totalChunks++;
      } else if (fileExt === '.txt') {
        // Process text files
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split('\n');
        
        // Group lines into chunks of approximately 4500 chars each
        const chunks = [];
        let currentChunk = '';
        let chunkId = 1;
        
        for (const line of lines) {
          if (line.trim().length === 0) continue;
          
          if (currentChunk.length + line.length > 4500 && currentChunk.length > 0) {
            chunks.push({
              id: `${fileId}-chunk-${chunkId}`,
              content: currentChunk.trim(),
              metadata: {
                source: fileName,
                chunk: chunkId,
                type: 'text'
              }
            });
            chunkId++;
            currentChunk = '';
          }
          
          currentChunk += line + '\n';
        }
        
        // Add the last chunk if not empty
        if (currentChunk.trim().length > 0) {
          chunks.push({
            id: `${fileId}-chunk-${chunkId}`,
            content: currentChunk.trim(),
            metadata: {
              source: fileName,
              chunk: chunkId,
              type: 'text'
            }
          });
        }
        
        // Add chunks to collection
        if (chunks.length > 0) {
          try {
            await collection.add({
              ids: chunks.map(chunk => chunk.id),
              documents: chunks.map(chunk => chunk.content),
              metadatas: chunks.map(chunk => chunk.metadata)
            });
          } catch (error) {
            console.error(`Failed to add ${fileName} chunks to ChromaDB:`, error);
            // Error is caught but NOT returned to the client
          }
        }
        
        processedFiles.push({ name: fileName, type: 'text', chunks: chunks.length });
        totalChunks += chunks.length;
      }
    }
    
    return res.status(200).json({ 
      message: `Successfully synced ${processedFiles.length} files from utils-data directory`,
      files: processedFiles,
      totalChunks
    });
  } catch (error) {
    console.error('Error syncing utils-data files:', error);
    return res.status(500).json({ error: 'Failed to sync files: ' + error.message });
  }
};

/**
 * Upload file content directly to the knowledge base
 * This endpoint allows sending raw file content instead of uploading a physical file
 */
export const uploadFileContent = async (req, res) => {
  try {
    const { fileName, content, fileType = 'text' } = req.body;
    
    if (!fileName || !content) {
      return res.status(400).json({ error: 'File name and content are required' });
    }
    
    // Get the collection
    const collection = await getOrCreateCollection(COLLECTION_NAME);
    
    const fileId = `content-upload-${fileName.replace(/\s+/g, '-')}-${Date.now()}`;
    let documentChunks = [];
    let totalChunks = 0;
    
    if (fileType === 'csv') {
      // Process as CSV data
      try {
        // Parse the CSV content into structured data
        // This is simplified - in production you'd use a CSV parser
        const rows = content.split('\n').map(row => {
          const values = row.split(',');
          return values.join(', ');
        });
        
        const csvContent = rows.join('\n');
        
        // Add to collection as a single document
        await collection.add({
          ids: [fileId],
          documents: [csvContent],
          metadatas: [{ 
            source: fileName, 
            type: 'csv',
            created: new Date().toISOString()
          }],
        });
        
        totalChunks = 1;
        documentChunks.push({ id: fileId, type: 'csv' });
      } catch (error) {
        console.error('Error processing CSV content:', error);
        return res.status(400).json({ error: 'Failed to process CSV content: ' + error.message });
      }
    } else {
      // Process as plain text - split into chunks
      const lines = content.split('\n');
      
      // Group lines into chunks of approximately 4500 chars each
      const chunks = [];
      let currentChunk = '';
      let chunkId = 1;
      
      for (const line of lines) {
        if (line.trim().length === 0) continue;
        
        if (currentChunk.length + line.length > 4500 && currentChunk.length > 0) {
          chunks.push({
            id: `${fileId}-chunk-${chunkId}`,
            content: currentChunk.trim(),
            metadata: {
              source: fileName,
              chunk: chunkId,
              type: 'text'
            }
          });
          chunkId++;
          currentChunk = '';
        }
        
        currentChunk += line + '\n';
      }
      
      // Add the last chunk if not empty
      if (currentChunk.trim().length > 0) {
        chunks.push({
          id: `${fileId}-chunk-${chunkId}`,
          content: currentChunk.trim(),
          metadata: {
            source: fileName,
            chunk: chunkId,
            type: 'text'
          }
        });
      }
      
      // Add chunks to collection
      if (chunks.length > 0) {
        try {
          await collection.add({
            ids: chunks.map(chunk => chunk.id),
            documents: chunks.map(chunk => chunk.content),
            metadatas: chunks.map(chunk => chunk.metadata)
          });
          
          totalChunks = chunks.length;
          documentChunks = chunks.map(chunk => ({ id: chunk.id, type: 'text' }));
        } catch (error) {
          console.error(`Failed to add content chunks to ChromaDB:`, error);
          return res.status(500).json({ error: 'Failed to add chunks to ChromaDB: ' + error.message });
        }
      }
    }
    
    return res.status(200).json({ 
      message: `Successfully uploaded content as ${fileName}`,
      chunks: totalChunks,
      documents: documentChunks
    });
  } catch (error) {
    console.error('Error uploading file content:', error);
    return res.status(500).json({ error: 'Failed to upload file content: ' + error.message });
  }
};

/**
 * Check ChromaDB status and return information about collections
 */
export const checkChromaStatus = async (req, res) => {
  try {
    // ChromaDB typically runs on port 8000
    const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
    
    try {
      // Try different API versions for heartbeat
      let heartbeatResponse;
      let apiVersion;
      
      // First try API v2 (what the rest of the codebase uses)
      try {
        heartbeatResponse = await axios.get(`${chromaUrl}/api/v2/heartbeat`);
        apiVersion = 'v2';
      } catch (v2Error) {
        console.log('ChromaDB v2 API not available, trying other versions...');
        
        // Try API v1
        try {
          heartbeatResponse = await axios.get(`${chromaUrl}/api/v1/heartbeat`);
          apiVersion = 'v1';
        } catch (v1Error) {
          // Try API without version prefix (newer versions)
          try {
            heartbeatResponse = await axios.get(`${chromaUrl}/heartbeat`);
            apiVersion = 'latest';
          } catch (noVersionError) {
            // Try legacy endpoint
            try {
              heartbeatResponse = await axios.get(`${chromaUrl}/api/heartbeat`);
              apiVersion = 'legacy';
            } catch (legacyError) {
              throw new Error('No valid ChromaDB API endpoint found');
            }
          }
        }
      }
      
      console.log(`Connected to ChromaDB using API ${apiVersion}`);
      
      // Get collections information based on API version
      let collections = [];
      try {
        let collectionsResponse;
        if (apiVersion === 'v2') {
          collectionsResponse = await axios.get(`${chromaUrl}/api/v2/collections`);
        } else if (apiVersion === 'v1') {
          collectionsResponse = await axios.get(`${chromaUrl}/api/v1/collections`);
        } else if (apiVersion === 'latest') {
          collectionsResponse = await axios.get(`${chromaUrl}/collections`);
        } else {
          collectionsResponse = await axios.get(`${chromaUrl}/api/collections`);
        }
        
        collections = collectionsResponse.data || [];
      } catch (collectionsError) {
        console.error('Error getting collections:', collectionsError);
      }
      
      // Check our collection by using chromadb.js functions directly
      let collectionInfo = { exists: false, count: 0 };
      try {
        const collection = await getOrCreateCollection(COLLECTION_NAME);
        collectionInfo.exists = true;
        
        // Get document count if possible
        try {
          const count = await collection.count();
          collectionInfo.count = count;
        } catch (countErr) {
          console.error('Error getting document count:', countErr);
        }
      } catch (collectionErr) {
        console.error('Error checking collection:', collectionErr);
      }
      
      return res.status(200).json({
        status: 'connected',
        message: 'ChromaDB is running',
        apiVersion,
        collections: Array.isArray(collections) ? collections.length : 'Unknown',
        collection: {
          name: COLLECTION_NAME,
          exists: collectionInfo.exists,
          documents: collectionInfo.count
        }
      });
    } catch (error) {
      console.error('ChromaDB connection error:', error);
      return res.status(503).json({
        status: 'disconnected',
        message: 'ChromaDB connection failed',
        error: error.message
      });
    }
  } catch (error) {
    console.error('Error checking ChromaDB status:', error);
    return res.status(500).json({ error: 'Failed to check ChromaDB status: ' + error.message });
  }
}; 