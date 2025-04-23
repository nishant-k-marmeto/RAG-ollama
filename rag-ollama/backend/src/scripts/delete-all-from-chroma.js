import { ChromaClient } from 'chromadb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Collection name
const COLLECTION_NAME = 'rag_documents';

// Initialize ChromaDB client
const client = new ChromaClient({
  path: process.env.CHROMA_URL || "http://localhost:8000"
});

async function deleteAllDocumentsFromCollection() {
  try {
    console.log(`Connecting to ChromaDB...`);
    
    // Get the collection
    console.log(`Getting collection "${COLLECTION_NAME}"...`);
    const collection = await client.getCollection({
      name: COLLECTION_NAME,
    });
    
    // Get all document IDs
    console.log(`Retrieving documents from collection...`);
    const allDocuments = await collection.get();
    
    if (allDocuments && allDocuments.ids && allDocuments.ids.length > 0) {
      console.log(`Found ${allDocuments.ids.length} documents to delete.`);
      
      // Delete all documents by IDs
      console.log(`Deleting all documents...`);
      await collection.delete({
        ids: allDocuments.ids
      });
      
      console.log(`✅ Successfully deleted ${allDocuments.ids.length} documents from collection "${COLLECTION_NAME}".`);
    } else {
      console.log(`No documents found in collection "${COLLECTION_NAME}".`);
    }
  } catch (error) {
    console.error(`❌ Error deleting documents:`, error);
  }
}

// Execute the function
deleteAllDocumentsFromCollection()
  .then(() => {
    console.log('Script execution completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  }); 