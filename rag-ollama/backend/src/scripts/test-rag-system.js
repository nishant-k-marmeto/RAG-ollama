import dotenv from 'dotenv';
import { getOrCreateCollection, queryCollection } from '../utils/chromadb.js';
import { addDocument } from '../services/documentService.js';

// Load environment variables
dotenv.config();

/**
 * Test script to verify RAG functionality
 */
async function testRagSystem() {
  try {
    console.log('===== TESTING RAG SYSTEM =====');
    
    // Step 1: Get or create the collection
    console.log('Step 1: Getting collection...');
    const collection = await getOrCreateCollection('rag_documents');
    console.log(`Collection retrieved: ${collection.name}`);
    
    // Step 2: Add a test document
    console.log('\nStep 2: Adding test document...');
    const testDoc = {
      title: 'Test Document',
      content: 'This is a test document to verify that the RAG system is working correctly. It contains information about apples, bananas, and other fruits.',
    };
    
    await addDocument(testDoc.title, testDoc.content, { type: 'test' });
    console.log('Test document added successfully');
    
    // Step 3: Query for the test document
    console.log('\nStep 3: Querying for the test document...');
    const results = await queryCollection(collection, 3, ['information about fruits']);
    
    console.log('Query results:');
    console.log(`- Number of results: ${results.ids[0]?.length || 0}`);
    
    if (results.ids[0]?.length > 0) {
      console.log('\nDocument details:');
      for (let i = 0; i < results.ids[0].length; i++) {
        console.log(`\nResult ${i + 1}:`);
        console.log(`- ID: ${results.ids[0][i]}`);
        console.log(`- Content snippet: "${results.documents[0][i].substring(0, 100)}..."`);
        console.log(`- Metadata: ${JSON.stringify(results.metadatas[0][i])}`);
        console.log(`- Distance: ${results.distances[0][i].toFixed(4)}`);
      }
      console.log('\n✅ RAG system is working correctly!');
    } else {
      console.log('❌ No documents found in the query results');
      console.log('This may indicate an issue with embeddings or document retrieval');
    }
    
    // Step 4: Verify collection contents
    console.log('\nStep 4: Checking all documents in collection...');
    const allDocs = await collection.get();
    console.log(`Total documents in collection: ${allDocs.ids.length}`);
    
    if (allDocs.ids.length > 0) {
      console.log(`Sample document ID: ${allDocs.ids[0]}`);
      console.log(`Sample document metadata: ${JSON.stringify(allDocs.metadatas[0])}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing RAG system:', error);
    console.error(error.stack);
  }
}

// Run the test
testRagSystem().then(() => {
  console.log('Test script completed');
  process.exit(0);
}).catch(err => {
  console.error('Test script failed:', err);
  process.exit(1);
}); 