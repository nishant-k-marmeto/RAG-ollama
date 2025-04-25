import { v4 as uuidv4 } from 'uuid';
import { getOrCreateCollection, deleteAllDocuments, queryCollection } from '../utils/chromadb.js';
import { chunkTextBySentences } from '../utils/data_loader.js';

// Collection name for ChromaDB
const COLLECTION_NAME = 'rag_documents';

/**
 * Add a document to ChromaDB
 * @param {string} title - Document title
 * @param {string} content - Document content
 * @param {object} metadata - Additional metadata
 * @returns {Promise<object>} - Result including document ID
 */
export async function addDocument(title, content, metadata = {}) {
  try {
    console.log(`Adding document: ${title}`);
    
    // Generate a unique ID
    const docId = uuidv4();
    
    // Get or create collection
    const collection = await getOrCreateCollection(COLLECTION_NAME);
    
    // Prepare metadata
    const documentMetadata = {
      source: title,
      type: 'text',
      ...metadata,
      timestamp: new Date().toISOString()
    };
    
    // Add document to ChromaDB (embeddings will be generated automatically)
    await collection.add({
      ids: [docId],
      documents: [content],
      metadatas: [documentMetadata]
    });
    
    console.log(`Document added with ID: ${docId}`);
    
    return {
      id: docId,
      title,
      metadata: documentMetadata
    };
  } catch (error) {
    console.error('Error adding document:', error);
    throw new Error(`Failed to add document: ${error.message}`);
  }
}

/**
 * Add multiple documents to ChromaDB
 * @param {object[]} documents - Array of document objects {title, content, metadata}
 * @returns {Promise<object[]>} - Results including document IDs
 */
export async function addDocuments(documents) {
  try {
    console.log(`Adding ${documents.length} documents in batch`);
    
    // Get or create collection
    const collection = await getOrCreateCollection(COLLECTION_NAME);
    
    // Prepare data
    const ids = documents.map(() => uuidv4());
    const contents = documents.map(doc => doc.content);
    const metadatas = documents.map((doc, index) => ({
      source: doc.title,
      type: 'text',
      ...(doc.metadata || {}),
      timestamp: new Date().toISOString()
    }));
    
    // Add documents to ChromaDB
    await collection.add({
      ids,
      documents: contents,
      metadatas
    });
    
    console.log(`${documents.length} documents added to ChromaDB`);
    
    return documents.map((doc, index) => ({
      id: ids[index],
      title: doc.title,
      metadata: metadatas[index]
    }));
  } catch (error) {
    console.error('Error adding documents in batch:', error);
    throw new Error(`Failed to add documents: ${error.message}`);
  }
}

/**
 * Add a large document by chunking it using sentence boundaries
 * @param {string} title - Document title
 * @param {string} content - Document content
 * @param {object} metadata - Additional metadata
 * @param {number} chunkSize - Approximate size of each chunk
 * @returns {Promise<object[]>} - Array of chunk results
 */
export async function addLargeDocument(title, content, metadata = {}, chunkSize = 1000) {
  try {
    console.log(`Adding large document: ${title} (${content.length} chars)`);
    
    // Chunk the document using sentence-based chunking
    const chunks = chunkTextBySentences(content, chunkSize);
    console.log(`Split into ${chunks.length} semantically meaningful chunks`);
    
    // Prepare chunk documents
    const chunkDocuments = chunks.map((chunk, index) => ({
      title: `${title} [chunk ${index+1}/${chunks.length}]`,
      content: chunk,
      metadata: {
        ...metadata,
        parentDocument: title,
        chunkIndex: index,
        totalChunks: chunks.length
      }
    }));
    
    // Add chunks as separate documents
    return await addDocuments(chunkDocuments);
  } catch (error) {
    console.error('Error adding large document:', error);
    throw new Error(`Failed to add large document: ${error.message}`);
  }
}

/**
 * Query the ChromaDB for documents matching the search query
 * @param {string} query - The search query string
 * @param {object} options - Query options
 * @param {number} options.limit - Maximum number of results to return (default: 5)
 * @param {string} options.collectionName - The collection to query (default: COLLECTION_NAME)
 * @param {object} options.filters - Metadata filters for the query
 * @param {boolean} options.includeMetadata - Whether to include metadata in results (default: true)
 * @param {boolean} options.includeDistances - Whether to include distances in results (default: true)
 * @returns {Promise<object>} - Search results with documents and metadata
 */
export async function queryDocuments(query, options = {}) {
  try {
    const {
      limit = 5,
      collectionName = COLLECTION_NAME,
      filters = {},
      includeMetadata = true,
      includeDistances = true
    } = options;

    console.log(`Querying documents with: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
    console.log(`Options: limit=${limit}, filters=${JSON.stringify(filters)}`);

    // Start timing
    const startTime = Date.now();
    
    // Get the collection
    const collection = await getOrCreateCollection(collectionName);
    
    // Query collection
    const queryOptions = { where: filters };
    const results = await queryCollection(collection, limit, [query], queryOptions);
    
    // End timing
    const endTime = Date.now();
    const queryTime = endTime - startTime;
    
    // Process results
    let formattedResults = [];
    
    if (results && results.documents && results.documents[0] && results.documents[0].length > 0) {
      console.log(`Found ${results.documents[0].length} matching documents in ${queryTime}ms`);
      
      // Format the results
      formattedResults = results.documents[0].map((doc, i) => {
        const result = {
          id: results.ids[0][i],
          content: doc
        };
        
        if (includeMetadata && results.metadatas && results.metadatas[0]) {
          result.metadata = results.metadatas[0][i];
        }
        
        if (includeDistances && results.distances && results.distances[0]) {
          result.distance = results.distances[0][i];
          // Add similarity score (1 - normalized distance)
          result.similarity = 1 - (results.distances[0][i] / 2); // Assuming distance range of 0-2
        }
        
        return result;
      });
    } else {
      console.log(`No documents found matching query (${queryTime}ms)`);
    }
    
    return {
      results: formattedResults,
      query,
      count: formattedResults.length,
      metrics: {
        queryTimeMs: queryTime,
        searchedCollection: collectionName
      }
    };
  } catch (error) {
    console.error('Error querying documents:', error);
    throw new Error(`Failed to query documents: ${error.message}`);
  }
}

/**
 * Clear all documents from the collection
 * @returns {Promise<boolean>} - Success status
 */
export async function clearAllDocuments() {
  try {
    console.log('Clearing all documents from collection');
    
    // Get collection
    const collection = await getOrCreateCollection(COLLECTION_NAME);
    
    // Delete all documents
    const result = await deleteAllDocuments(collection);
    
    console.log('All documents cleared from collection');
    
    return result;
  } catch (error) {
    console.error('Error clearing documents:', error);
    throw new Error(`Failed to clear documents: ${error.message}`);
  }
} 