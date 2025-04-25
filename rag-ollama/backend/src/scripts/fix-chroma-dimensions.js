const { ChromaClient } = require('chromadb');
const { OllamaEmbeddingFunction } = require('chromadb');
require('dotenv').config();

// Hardcoded dimension value to 384
const TARGET_DIMENSION = 384;
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'rag_documents';
const BATCH_SIZE = 50; // For adding documents back in batches

async function fixChromaDimensions() {
  console.log(`\n=== ChromaDB Dimension Fix ===`);
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Target dimension: ${TARGET_DIMENSION}`);
  
  // Initialize ChromaDB client
  const client = new ChromaClient({
    path: process.env.CHROMA_URL || "http://localhost:8000",
    apiPath: process.env.CHROMA_API_PATH || "/api/v1",
  });

  try {
    console.log('\nChecking for existing collection...');
    
    // Check if collection exists
    const collections = await client.listCollections();
    const collectionExists = collections.some(c => c.name === COLLECTION_NAME);
    
    if (!collectionExists) {
      console.log(`Collection '${COLLECTION_NAME}' does not exist. Creating new collection...`);
      createNewCollection(client);
      return;
    }
    
    // Get existing collection
    const collection = await client.getCollection({
      name: COLLECTION_NAME,
    });
    
    // Get all documents from existing collection
    console.log(`Getting all documents from '${COLLECTION_NAME}'...`);
    const allDocs = await collection.get();
    
    const documentCount = allDocs.ids.length;
    console.log(`Found ${documentCount} documents in the collection.`);
    
    if (documentCount === 0) {
      console.log('Collection is empty. Recreating with correct dimensions...');
      await client.deleteCollection({ name: COLLECTION_NAME });
      await createNewCollection(client);
      return;
    }
    
    // Backup existing documents
    console.log('Backing up existing documents...');
    const backup = {
      ids: allDocs.ids,
      documents: allDocs.documents,
      metadatas: allDocs.metadatas,
    };
    
    // Delete the existing collection
    console.log(`Deleting collection '${COLLECTION_NAME}'...`);
    await client.deleteCollection({ name: COLLECTION_NAME });
    
    // Create a new collection with correct dimensions
    console.log(`Creating new collection with ${TARGET_DIMENSION}-dimensional embeddings...`);
    const embeddingFunction = new OllamaEmbeddingFunction({
      url: process.env.OLLAMA_HOST || "http://localhost:11434",
      model: process.env.OLLAMA_EMBEDDING_MODEL || "llama3:1b",
      dimensions: TARGET_DIMENSION,
    });
    
    const newCollection = await client.createCollection({
      name: COLLECTION_NAME,
      metadata: { 
        description: "RAG System Documents",
        "hnsw:space": "l2"
      },
      embeddingFunction,
    });
    
    // Add documents back in batches
    console.log(`Adding ${documentCount} documents back to the collection in batches...`);
    
    for (let i = 0; i < documentCount; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, documentCount);
      console.log(`Adding batch ${i+1} to ${batchEnd} of ${documentCount}...`);
      
      await newCollection.add({
        ids: backup.ids.slice(i, batchEnd),
        documents: backup.documents.slice(i, batchEnd),
        metadatas: backup.metadatas.slice(i, batchEnd),
      });
    }
    
    console.log('\n✅ Collection dimension fix complete! All documents restored.');
    
    // Verify by checking a document's embedding
    if (documentCount > 0) {
      const testResult = await newCollection.get({
        ids: [backup.ids[0]],
        include: ['embeddings'],
      });
      
      if (testResult.embeddings && testResult.embeddings.length > 0) {
        const dimension = testResult.embeddings[0].length;
        console.log(`\nVerified embedding dimension: ${dimension}`);
        
        if (dimension === TARGET_DIMENSION) {
          console.log('✅ Collection now has the correct embedding dimension!');
        } else {
          console.log(`⚠️ Warning: Collection has unexpected embedding dimension (${dimension} instead of ${TARGET_DIMENSION}).`);
        }
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error fixing collection dimensions:', error);
    process.exit(1);
  }
}

async function createNewCollection(client) {
  try {
    const embeddingFunction = new OllamaEmbeddingFunction({
      url: process.env.OLLAMA_HOST || "http://localhost:11434",
      model: process.env.OLLAMA_EMBEDDING_MODEL || "llama3:1b",
      dimensions: TARGET_DIMENSION,
    });
    
    await client.createCollection({
      name: COLLECTION_NAME,
      metadata: { 
        description: "RAG System Documents", 
        "hnsw:space": "l2"
      },
      embeddingFunction,
    });
    
    console.log(`\n✅ New collection '${COLLECTION_NAME}' created with ${TARGET_DIMENSION}-dimensional embeddings.`);
  } catch (error) {
    console.error('\n❌ Error creating new collection:', error);
    process.exit(1);
  }
}

fixChromaDimensions().catch(console.error); 