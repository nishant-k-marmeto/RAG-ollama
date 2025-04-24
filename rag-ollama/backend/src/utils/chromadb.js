import { ChromaClient, DefaultEmbeddingFunction } from 'chromadb';

// Initialize ChromaDB client
const client = new ChromaClient({
  path: process.env.CHROMA_URL || "http://localhost:8000",
  apiPath: process.env.CHROMA_API_PATH || "/api/v2",
});

// Initialize the embedding function
const embeddingFunction = new DefaultEmbeddingFunction();

/**
 * Get or create a collection in ChromaDB
 * @param {string} name - Collection name
 * @returns {object} The ChromaDB collection
 */
export async function getOrCreateCollection(name = "nishant-collection") {
  try {
    console.log(`Attempting to get or create collection: ${name}`);
    const collection = await client.getOrCreateCollection({
      name,
      metadata: {
        description: "RAG System Documents",
        "hnsw:space": "l2"
      },
      embeddingFunction,
    });
    
    console.log(`Collection "${name}" ready`);
    return collection;
  } catch (error) {
    console.error(`Error getting/creating collection "${name}":`, error);
    throw error;
  }
}

/**
 * Query a collection for relevant documents
 * @param {object} collection - The ChromaDB collection
 * @param {number} nResults - Number of results to return
 * @param {string[]} queryTexts - Array of query texts
 * @returns {object} Query results
 */
export async function queryCollection(collection, nResults, queryTexts) {
  try {
    const results = await collection.query({
      nResults,
      queryTexts,
    });
    
    return results;
  } catch (error) {
    console.error('Error querying collection:', error);
    throw error;
  }
}

/**
 * Get all documents in a collection
 * @param {object} collection - The ChromaDB collection
 * @returns {object} All documents in the collection
 */
export async function getAllDocuments(collection) {
  try {
    return await collection.get();
  } catch (error) {
    console.error('Error getting all documents:', error);
    throw error;
  }
}

/**
 * Delete a document from a collection
 * @param {object} collection - The ChromaDB collection
 * @param {string} id - Document ID to delete
 */
export async function deleteDocument(collection, id) {
  try {
    await collection.delete({
      ids: [id]
    });
    console.log(`Document ${id} deleted`);
  } catch (error) {
    console.error(`Error deleting document ${id}:`, error);
    throw error;
  }
}

/**
 * Delete all documents from a collection
 * @param {object} collection - The ChromaDB collection
 * @returns {boolean} Success status
 */
export async function deleteAllDocuments(collection) {
  try {
    // First get all document IDs
    const allDocuments = await collection.get();
    
    if (allDocuments && allDocuments.ids && allDocuments.ids.length > 0) {
      // Delete all documents by their IDs
      await collection.delete({
        ids: allDocuments.ids
      });
      
      console.log(`Successfully deleted ${allDocuments.ids.length} documents from collection`);
      return true;
    } else {
      console.log('No documents found in collection to delete');
      return true;
    }
  } catch (error) {
    console.error('Error deleting all documents:', error);
    throw error;
  }
} 