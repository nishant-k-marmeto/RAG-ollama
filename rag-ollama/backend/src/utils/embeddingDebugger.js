import { ChromaClient } from 'chromadb';
import { OllamaEmbeddingFunction } from 'chromadb';

/**
 * Utility to debug and fix embedding issues in ChromaDB
 */

/**
 * Check collection embedding dimension
 * @param {string} collectionName - Name of the collection
 * @returns {Promise<number|null>} - Embedding dimension or null if unavailable
 */
export async function checkCollectionEmbeddingDimension(collectionName) {
  try {
    console.log(`Checking embedding dimension for collection: ${collectionName}`);
    const client = new ChromaClient({
      path: process.env.CHROMA_URL || "http://localhost:8000",
      apiPath: process.env.CHROMA_API_PATH || "/api/v2",
    });

    // Check if collection exists
    try {
      const collections = await client.listCollections();
      const collectionExists = collections.some(c => c.name === collectionName);
      
      if (!collectionExists) {
        console.log(`Collection '${collectionName}' does not exist yet.`);
        return null;
      }
    } catch (error) {
      console.error('Error checking if collection exists:', error);
      return null;
    }

    // Get collection
    const collection = await client.getCollection({
      name: collectionName,
    });

    // Add a test item with include embeddings to check dimension
    const testId = `dimension-test-${Date.now()}`;
    const testContent = "This is a test document to determine embedding dimension.";
    
    // First try to add without embedding function to see if embedding is handled server-side
    try {
      await collection.add({
        ids: [testId],
        documents: [testContent],
        metadatas: [{ source: "dimension-test" }],
      });

      // Get the item back with embeddings
      const result = await collection.get({
        ids: [testId],
        include: ["embeddings"],
      });

      // Delete the test item
      await collection.delete({ ids: [testId] });

      if (result.embeddings && result.embeddings.length > 0) {
        const dimension = result.embeddings[0].length;
        console.log(`Collection ${collectionName} has embeddings with dimension: ${dimension}`);
        return dimension;
      } else {
        console.log(`No embeddings found in collection ${collectionName}`);
        return null;
      }
    } catch (error) {
      console.log(`Could not determine dimension automatically: ${error.message}`);
      
      // Only try 384 dimension since that's our hardcoded standard
      const dimension = 384;
      try {
        console.log(`Trying with hardcoded dimension: ${dimension}...`);
        
        const embeddingFunction = new OllamaEmbeddingFunction({
          url: process.env.OLLAMA_HOST || "http://localhost:11434",
          model: "llama3.2:1b",
          dimensions: dimension
        });
        
        // Create a new client with this embedding function
        const collectionWithEmbedding = await client.getCollection({
          name: collectionName,
          embeddingFunction
        });
        
        // Test adding an item
        const testId = `dimension-test-${Date.now()}-${dimension}`;
        await collectionWithEmbedding.add({
          ids: [testId],
          documents: [testContent],
          metadatas: [{ source: "dimension-test" }],
        });
        
        // If we get here, it worked
        console.log(`Success with dimension: ${dimension}`);
        
        // Delete the test item
        await collectionWithEmbedding.delete({ ids: [testId] });
        
        return dimension;
      } catch (tryError) {
        console.error(`Error testing dimension ${dimension}:`, tryError);
        return null;
      }
    }
  } catch (error) {
    console.error('Error checking collection embedding dimension:', error);
    return null;
  }
}

/**
 * Fix embedding dimension mismatch by recreating the collection
 * @param {string} collectionName - Name of the collection
 * @param {number} dimension - Embedding dimension to use
 * @returns {Promise<boolean>} - Success status
 */
export async function fixEmbeddingDimension(collectionName, dimension) {
  try {
    console.log(`Fixing embedding dimension for collection '${collectionName}' to ${dimension}`);
    
    const client = new ChromaClient({
      path: process.env.CHROMA_URL || "http://localhost:8000",
      apiPath: process.env.CHROMA_API_PATH || "/api/v2",
    });
    
    // Create embedding function with explicit dimension
    const embeddingFunction = new OllamaEmbeddingFunction({
      url: process.env.OLLAMA_HOST || "http://localhost:11434",
      model: "llama3.2:1b",
      dimensions: 384
    });
    
    // Check if collection exists
    const collections = await client.listCollections();
    const collectionExists = collections.some(c => c.name === collectionName);
    
    // If collection exists, get documents first, then delete
    let documents = null;
    if (collectionExists) {
      try {
        // Try to get all documents
        const collection = await client.getCollection({
          name: collectionName,
        });
        
        documents = await collection.get();
        console.log(`Retrieved ${documents.ids.length} documents from collection`);
        
        // Delete collection
        await client.deleteCollection({ name: collectionName });
        console.log(`Deleted collection '${collectionName}'`);
      } catch (error) {
        console.error('Error retrieving or deleting collection:', error);
        return false;
      }
    }
    
    // Create new collection with proper embedding function
    const newCollection = await client.createCollection({
      name: collectionName,
      metadata: { description: "RAG System Documents", "hnsw:space": "l2" },
      embeddingFunction
    });
    
    console.log(`Created new collection '${collectionName}' with dimension ${dimension}`);
    
    // If we have documents, re-add them
    if (documents && documents.ids.length > 0) {
      // Re-add in batches to avoid overwhelming the server
      const batchSize = 100;
      for (let i = 0; i < documents.ids.length; i += batchSize) {
        const batchIds = documents.ids.slice(i, i + batchSize);
        const batchDocs = documents.documents.slice(i, i + batchSize);
        const batchMetadata = documents.metadatas.slice(i, i + batchSize);
        
        console.log(`Adding batch ${i/batchSize + 1}: ${batchIds.length} documents`);
        
        await newCollection.add({
          ids: batchIds,
          documents: batchDocs,
          metadatas: batchMetadata
        });
      }
      
      console.log(`Successfully restored ${documents.ids.length} documents to the collection`);
    }
    
    return true;
  } catch (error) {
    console.error('Error fixing embedding dimension:', error);
    return false;
  }
} 