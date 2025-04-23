import { getOrCreateCollection } from '../utils/chromadb.js';

/**
 * Example script showing how to add documents to ChromaDB
 */

async function addSampleDocumentsToChroma() {
  try {
    console.log('Getting or creating collection...');
    // Get the collection (will be created if it doesn't exist)
    const collection = await getOrCreateCollection('nishant-collection');
    
    // Sample documents to add
    const documents = [
      {
        id: `sample-doc-${Date.now()}-1`,
        content: "This is a sample document about artificial intelligence. AI is transforming industries through machine learning and neural networks.",
        metadata: { source: "sample", category: "technology", tags: ["AI", "machine learning"] }
      },
      {
        id: `sample-doc-${Date.now()}-2`,
        content: "Climate change is a pressing issue. Renewable energy sources like solar and wind are becoming increasingly important.",
        metadata: { source: "sample", category: "environment", tags: ["climate", "energy"] }
      }
    ];
    
    console.log(`Adding ${documents.length} documents to ChromaDB...`);
    
    // Add documents to the collection
    await collection.add({
      ids: documents.map(doc => doc.id),
      documents: documents.map(doc => doc.content),
      metadatas: documents.map(doc => doc.metadata)
    });
    
    console.log('✅ Documents successfully added to ChromaDB!');
    
    // Query the collection to verify documents were added
    console.log('\nRetrieving all documents to verify:');
    const allDocs = await collection.get();
    
    console.log(`Found ${allDocs.ids.length} documents in the collection:`);
    allDocs.ids.forEach((id, index) => {
      console.log(`\nDocument ${index + 1}:`);
      console.log(`- ID: ${id}`);
      console.log(`- Content: ${allDocs.documents[index].substring(0, 50)}...`);
      console.log(`- Metadata: ${JSON.stringify(allDocs.metadatas[index])}`);
    });
    
  } catch (error) {
    console.error('Error adding documents to ChromaDB:', error);
    console.error('Make sure ChromaDB server is running with: npm run start:chroma');
  }
}

// Run the function
addSampleDocumentsToChroma(); 