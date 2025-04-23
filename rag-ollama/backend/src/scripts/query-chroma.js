import { getOrCreateCollection, queryCollection } from '../utils/chromadb.js';

/**
 * Example script showing how to query documents from ChromaDB
 */

async function queryChromatDB() {
  try {
    console.log('Getting collection...');
    // Get the collection 
    const collection = await getOrCreateCollection('nishant-collection');
    
    // Example queries
    const queries = [
      "artificial intelligence",
      "climate change",
      "renewable energy"
    ];
    
    // Number of results to return
    const nResults = 2;
    
    for (const query of queries) {
      console.log(`\n\nQuerying for: "${query}"...`);
      
      // Query the collection
      const results = await queryCollection(collection, nResults, [query]);
      
      console.log(`Found ${results.ids[0]?.length || 0} matching documents:`);
      
      if (results.ids[0]?.length > 0) {
        for (let i = 0; i < results.ids[0].length; i++) {
          console.log(`\nResult ${i + 1}:`);
          console.log(`- ID: ${results.ids[0][i]}`);
          console.log(`- Content: ${results.documents[0][i].substring(0, 100)}...`);
          console.log(`- Metadata: ${JSON.stringify(results.metadatas[0][i])}`);
          console.log(`- Distance: ${results.distances[0][i]}`);
        }
      } else {
        console.log('No matching documents found');
      }
    }
    
    // Alternative: Get all documents
    console.log('\n\nGetting all documents in the collection:');
    const allDocs = await collection.get();
    
    console.log(`Found ${allDocs.ids.length} total documents in the collection.`);
    
  } catch (error) {
    console.error('Error querying ChromaDB:', error);
    console.error('Make sure ChromaDB server is running with: npm run start:chroma');
  }
}

// Run the function
queryChromatDB(); 