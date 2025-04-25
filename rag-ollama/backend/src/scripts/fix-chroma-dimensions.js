import { checkCollectionEmbeddingDimension, fixEmbeddingDimension } from '../utils/embeddingDebugger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Collection name
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'rag_documents';

// Get target dimension from command line args or default to 384
const args = process.argv.slice(2);
let targetDimension = 384;

if (args.length > 0 && !isNaN(parseInt(args[0]))) {
  targetDimension = parseInt(args[0]);
}

async function main() {
  console.log(`\n=== ChromaDB Embedding Dimension Fixer ===`);
  console.log(`Checking collection: ${COLLECTION_NAME}`);
  console.log(`Target dimension: ${targetDimension}`);

  // First check the current dimension
  const currentDimension = await checkCollectionEmbeddingDimension(COLLECTION_NAME);
  
  if (currentDimension === null) {
    console.log(`\nCould not determine current embedding dimension.`);
    console.log(`This could be because the collection doesn't exist yet or there's an issue accessing it.`);
    
    const proceed = await askQuestion('Would you like to create/recreate the collection with dimension ' + targetDimension + '? (y/n): ');
    
    if (proceed.toLowerCase() === 'y') {
      console.log(`\nCreating collection with dimension ${targetDimension}...`);
      const success = await fixEmbeddingDimension(COLLECTION_NAME, targetDimension);
      
      if (success) {
        console.log(`\n✅ Successfully created collection with dimension ${targetDimension}.`);
      } else {
        console.log(`\n❌ Failed to create collection.`);
      }
    } else {
      console.log('Operation cancelled.');
    }
  } else if (currentDimension === targetDimension) {
    console.log(`\n✅ Collection already has the correct dimension (${currentDimension}).`);
    console.log('No changes needed.');
  } else {
    console.log(`\n⚠️ Dimension mismatch detected!`);
    console.log(`Current dimension: ${currentDimension}`);
    console.log(`Target dimension: ${targetDimension}`);
    
    const proceed = await askQuestion('Do you want to fix this by recreating the collection? (y/n): ');
    
    if (proceed.toLowerCase() === 'y') {
      console.log(`\nRecreating collection with dimension ${targetDimension}...`);
      console.log('This will attempt to preserve all existing documents.');
      
      const success = await fixEmbeddingDimension(COLLECTION_NAME, targetDimension);
      
      if (success) {
        console.log(`\n✅ Successfully fixed collection dimension to ${targetDimension}.`);
      } else {
        console.log(`\n❌ Failed to fix collection dimension.`);
      }
    } else {
      console.log('Operation cancelled.');
    }
  }
}

// Helper function to ask for user input
function askQuestion(question) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    readline.question(question, answer => {
      readline.close();
      resolve(answer);
    });
  });
}

// Run the main function
main()
  .then(() => {
    console.log('\nScript completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\nError:', error);
    process.exit(1);
  }); 