import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOrCreateCollection, queryCollection } from '../utils/chromadb.js';

// Get directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const utilsDataDir = path.join(__dirname, '../../utils-data');
const COLLECTION_NAME = 'rag_documents';

async function testUtilsDataAndEmbeddings() {
  console.log('=== Testing utils-data folder and ChromaDB embeddings ===');
  
  // Check if utils-data directory exists
  console.log(`Looking for utils-data directory at: ${utilsDataDir}`);
  if (!fs.existsSync(utilsDataDir)) {
    console.error(`❌ utils-data directory not found at: ${utilsDataDir}`);
    console.log('Creating directory...');
    try {
      fs.mkdirSync(utilsDataDir, { recursive: true });
      console.log(`✅ Created utils-data directory at: ${utilsDataDir}`);
    } catch (error) {
      console.error(`❌ Failed to create directory: ${error.message}`);
      return;
    }
  } else {
    console.log(`✅ utils-data directory exists at: ${utilsDataDir}`);
  }
  
  // Check if directory has files
  const files = fs.readdirSync(utilsDataDir);
  if (files.length === 0) {
    console.log(`❌ utils-data directory is empty`);
    
    // Create a sample text file for testing
    console.log('Creating a sample test file...');
    const sampleContent = 'This is a sample test file created for ChromaDB testing.\n' +
      'It contains multiple lines of text to demonstrate the chunking functionality.\n' +
      'Each line should be processed and added to the ChromaDB collection.\n' +
      'The embeddings generated will be displayed in the console for verification.\n' +
      'This will help debug any issues with the syncUtilsDataFiles function.';
    
    const sampleFilePath = path.join(utilsDataDir, 'sample-test.txt');
    fs.writeFileSync(sampleFilePath, sampleContent);
    console.log(`✅ Created sample file at: ${sampleFilePath}`);
  } else {
    console.log(`✅ Found ${files.length} files/folders in utils-data directory`);
    files.forEach((file, index) => {
      const filePath = path.join(utilsDataDir, file);
      const stats = fs.statSync(filePath);
      console.log(`  ${index + 1}. ${file} (${stats.isDirectory() ? 'directory' : 'file'}, ${stats.size} bytes)`);
    });
  }
  
  // Try to connect to ChromaDB and check collection
  try {
    console.log('\nConnecting to ChromaDB...');
    const collection = await getOrCreateCollection(COLLECTION_NAME);
    console.log(`✅ Connected to ChromaDB collection: ${COLLECTION_NAME}`);
    
    // Get all documents and their embeddings
    console.log('\nRetrieving documents with embeddings...');
    const result = await collection.get({
      include: ["embeddings", "documents", "metadatas"]
    });
    
    if (result && result.ids && result.ids.length > 0) {
      console.log(`✅ Found ${result.ids.length} documents in collection`);
      
      // Display embeddings for the first few documents
      console.log('\n====== EMBEDDING INFORMATION ======');
      console.log(`Embedding dimensions: ${result.embeddings[0].length}`);
      
      const samplesToShow = Math.min(3, result.ids.length);
      for (let i = 0; i < samplesToShow; i++) {
        const embedding = result.embeddings[i];
        console.log(`\nDocument ${i+1}:`);
        console.log(`- ID: ${result.ids[i]}`);
        console.log(`- Content: "${result.documents[i].substring(0, 50)}..."`);
        console.log(`- Metadata: ${JSON.stringify(result.metadatas[i])}`);
        
        // Get embedding statistics
        const embSum = embedding.reduce((sum, val) => sum + val, 0);
        const embAvg = embSum / embedding.length;
        const embMin = Math.min(...embedding);
        const embMax = Math.max(...embedding);
        
        console.log(`- Embedding stats: dimension=${embedding.length}, avg=${embAvg.toFixed(4)}, min=${embMin.toFixed(4)}, max=${embMax.toFixed(4)}`);
        console.log(`- Embedding preview: [${embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}...]`);
      }
      console.log('===================================');
      
      // Try a test query
      console.log('\nTesting query functionality...');
      const queryText = result.documents[0].split(' ').slice(0, 3).join(' '); // Use first few words of first document
      console.log(`Query: "${queryText}"`);
      
      const queryResult = await queryCollection(collection, 2, [queryText]);
      console.log(`✅ Query returned ${queryResult.documents[0].length} results`);
      for (let i = 0; i < queryResult.documents[0].length; i++) {
        console.log(`\nMatch ${i+1}:`);
        console.log(`- ID: ${queryResult.ids[0][i]}`);
        console.log(`- Content: "${queryResult.documents[0][i].substring(0, 50)}..."`);
        console.log(`- Distance: ${queryResult.distances[0][i].toFixed(4)}`);
      }
    } else {
      console.log(`❌ No documents found in collection`);
      console.log('You can use the syncUtilsDataFiles endpoint to add documents to ChromaDB');
    }
  } catch (error) {
    console.error(`❌ ChromaDB error: ${error.message}`);
    console.error(error);
  }
}

// Run the test
testUtilsDataAndEmbeddings()
  .then(() => console.log('\nTest completed'))
  .catch(error => console.error('Test failed:', error)); 