import { ChromaClient, OllamaEmbeddingFunction } from 'chromadb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Collection name
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'rag_documents';

// Default dimension
const TARGET_DIMENSION = 384;

/**
 * Reset the ChromaDB collection with the correct embedding dimensions
 */
async function resetCollection() {
  console.log(`🔄 Resetting ChromaDB collection "${COLLECTION_NAME}"...`);
  
  // Initialize ChromaDB client
  const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
  const client = new ChromaClient({ path: chromaUrl });
  
  try {
    // Check if collection exists
    const collections = await client.listCollections();
    const collectionExists = collections.some(c => c.name === COLLECTION_NAME);
    
    if (!collectionExists) {
      console.log(`⚠️ Collection "${COLLECTION_NAME}" does not exist. Nothing to reset.`);
      return;
    }
    
    // Delete the collection
    console.log(`🗑️ Deleting collection "${COLLECTION_NAME}"...`);
    await client.deleteCollection({ name: COLLECTION_NAME });
    console.log(`✅ Successfully deleted collection "${COLLECTION_NAME}".`);
    
    console.log(`🎉 ChromaDB collection reset complete.`);
  } catch (error) {
    console.error(`❌ Error resetting ChromaDB collection:`, error);
    process.exit(1);
  }
}

// Run the reset function
resetCollection()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  }); 