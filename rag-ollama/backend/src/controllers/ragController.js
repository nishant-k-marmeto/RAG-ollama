import * as ragService from '../services/ragService.js';
import { getOrCreateCollection, deleteAllDocuments as deleteAllChromaDocuments } from '../utils/chromadb.js';
import { addFilesToCollection } from '../utils/data_loader.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import axios from 'axios';
import { checkCollectionEmbeddingDimension } from '../utils/embeddingDebugger.js';

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
      if (typeof chunk === 'string') {
        // Handle string chunks (from updated service)
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      } else if (chunk && chunk.done) {
        // Handle completion notification
        // This will be handled separately below
      } else if (chunk) {
        // Handle any other format
        res.write(`data: ${JSON.stringify({ chunk: chunk.token || chunk })}\n\n`);
      }
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
    
    // Check collection embedding dimension
    const embeddingDimension = await checkCollectionEmbeddingDimension(COLLECTION_NAME);
    if (embeddingDimension) {
      console.log(`Collection uses embeddings with dimension: ${embeddingDimension}`);
      // If the embedding dimension doesn't match what we're using in our code, let the user know
      if (embeddingDimension !== 384) {
        console.log(`⚠️ WARNING: Collection uses ${embeddingDimension}-dimensional embeddings, but our configuration uses 384-dimensional embeddings.`);
        console.log(`Run 'npm run fix:chroma-dimensions:${embeddingDimension}' to fix this discrepancy.`);
      }
    }
    
    // Get list of files
    const files = fs.readdirSync(utilsDataDir);
    const processedFiles = [];
    let totalChunks = 0;
    let errors = [];
    
    // Process each file
    for (const file of files) {
      const filePath = path.join(utilsDataDir, file);
      
      try {
        const fileStats = fs.statSync(filePath);
        
        // Skip directories and hidden files
        if (fileStats.isDirectory() || file.startsWith('.')) {
          console.log(`Skipping directory or hidden file: ${file}`);
          continue;
        }
        
        const fileExt = path.extname(file).toLowerCase();
        const fileName = path.basename(file);
        const fileId = `utils-data-${fileName.replace(/\s+/g, '-')}`;
        
        console.log(`Processing file: ${fileName} (${fileExt}) with ID: ${fileId}`);
        
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
              .on('error', (err) => {
                console.error(`Error reading CSV ${fileName}:`, err);
                reject(err);
              });
          });
          
          console.log(`Read ${rows.length} rows from CSV file ${fileName}`);
          
          // Convert to string representation
          const content = rows.map(row => {
            return Object.entries(row)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');
          }).join('\n');
          
          // Add to collection
          try {
            console.log(`Adding CSV content to ChromaDB (${content.length} characters)`);
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
          } catch (error) {
            console.error(`Failed to add ${fileName} to ChromaDB:`, error);
            errors.push({ file: fileName, error: error.message });
            // Continue with other files
          }
        } else if (fileExt === '.txt') {
          // Process text files
          console.log(`Processing TXT file: ${fileName}`);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const lines = fileContent.split('\n');
          
          console.log(`Read ${lines.length} lines from TXT file ${fileName}`);
          
          // Group lines into chunks of approximately 500 chars each (appropriate for 384-dim embeddings)
          const chunks = [];
          let currentChunk = '';
          let chunkId = 1;
          
          for (const line of lines) {
            if (line.trim().length === 0) continue;
            
            if (currentChunk.length + line.length > 500 && currentChunk.length > 0) {
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
          
          console.log(`Created ${chunks.length} chunks from TXT file ${fileName}`);
          
          // Add chunks to collection
          if (chunks.length > 0) {
            try {
              console.log(`Adding ${chunks.length} chunks to ChromaDB...`);
              await collection.add({
                ids: chunks.map(chunk => chunk.id),
                documents: chunks.map(chunk => chunk.content),
                metadatas: chunks.map(chunk => chunk.metadata)
              });
              console.log(`Successfully added ${chunks.length} chunks to ChromaDB`);
              processedFiles.push({ name: fileName, type: 'text', chunks: chunks.length });
              totalChunks += chunks.length;
            } catch (error) {
              console.error(`Failed to add ${fileName} chunks to ChromaDB:`, error);
              errors.push({ file: fileName, error: error.message });
              
              // If this is a dimension mismatch error, provide more helpful information
              if (error.message && error.message.includes('expecting embedding with dimension')) {
                const match = error.message.match(/expecting embedding with dimension of (\d+), got (\d+)/);
                if (match && match.length === 3) {
                  const expectedDim = parseInt(match[1]);
                  const actualDim = parseInt(match[2]);
                  
                  console.error(`\n⚠️ EMBEDDING DIMENSION MISMATCH: Collection expects ${expectedDim}, but got ${actualDim}`);
                  console.error(`This typically happens when mixing different embedding models.`);
                  console.error(`To fix this, run: npm run fix:chroma-dimensions:${expectedDim}`);
                }
              }
            }
          }
        } else {
          console.log(`Skipping unsupported file type: ${fileExt} for file ${fileName}`);
        }
      } catch (fileError) {
        console.error(`Error processing file ${file}:`, fileError);
        errors.push({ file, error: fileError.message });
        // Continue processing other files
      }
    }
    
    // Get and display embeddings for the first few documents in the collection
    try {
      console.log('Fetching embeddings from ChromaDB...');
      const result = await collection.get({ 
        include: ["embeddings", "documents", "metadatas"],
        limit: 3 // Limit to first 3 documents for readability
      });
      
      if (result && result.embeddings && result.embeddings.length > 0) {
        console.log(`\n====== EMBEDDING INFORMATION ======`);
        console.log(`Total documents in collection: ${result.ids.length}`);
        console.log(`Embedding dimensions: ${result.embeddings[0].length}`);
        
        for (let i = 0; i < Math.min(result.ids.length, 3); i++) {
          const embedding = result.embeddings[i];
          console.log(`\nDocument ID: ${result.ids[i]}`);
          console.log(`Document: "${result.documents[i].substring(0, 50)}..."`);
          
          // Get embedding statistics
          const embSum = embedding.reduce((sum, val) => sum + val, 0);
          const embAvg = embSum / embedding.length;
          const embMin = Math.min(...embedding);
          const embMax = Math.max(...embedding);
          
          console.log(`Embedding stats: dimension=${embedding.length}, avg=${embAvg.toFixed(4)}, min=${embMin.toFixed(4)}, max=${embMax.toFixed(4)}`);
          console.log(`Embedding preview: [${embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`);
        }
        console.log(`\n===================================`);
      } else {
        console.log('No embeddings found in collection');
      }
    } catch (embeddingError) {
      console.error('Error fetching embeddings:', embeddingError);
    }
    
    const response = { 
      message: `Successfully synced ${processedFiles.length} files from utils-data directory`,
      files: processedFiles,
      totalChunks,
      directoryPath: utilsDataDir
    };
    
    // Add errors to response if there were any
    if (errors.length > 0) {
      response.errors = errors;
      response.errorCount = errors.length;
      response.message += ` with ${errors.length} errors`;
      
      // Check for dimension mismatch errors and add fix instructions
      const dimensionErrors = errors.filter(e => e.error && e.error.includes('expecting embedding with dimension'));
      if (dimensionErrors.length > 0) {
        // Extract dimensions from error message
        const match = dimensionErrors[0].error.match(/expecting embedding with dimension of (\d+), got (\d+)/);
        if (match && match.length === 3) {
          const expectedDim = parseInt(match[1]);
          response.fixInstructions = 
            `Embedding dimension mismatch detected. To fix this issue, run:\n` +
            `npm run fix:chroma-dimensions:${expectedDim}\n\n` +
            `This will fix the collection to use ${expectedDim}-dimensional embeddings.`;
        }
      }
    }
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Error syncing utils-data files:', error);
    return res.status(500).json({ 
      error: 'Failed to sync files: ' + error.message,
      stack: error.stack // Include stack trace for debugging
    });
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
      
      // Group lines into chunks of approximately 500 chars each (appropriate for 384-dim embeddings)
      const chunks = [];
      let currentChunk = '';
      let chunkId = 1;
      
      for (const line of lines) {
        if (line.trim().length === 0) continue;
        
        if (currentChunk.length + line.length > 500 && currentChunk.length > 0) {
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