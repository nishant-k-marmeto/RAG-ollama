import dotenv from 'dotenv';
import { OllamaEmbeddingFunction } from '../utils/ollamaEmbeddings.js';

// Load environment variables
dotenv.config();

/**
 * Test script to demonstrate and debug embeddings
 */
async function testEmbeddings() {
  try {
    console.log('Starting embedding test...');
    
    // Create embedding function with debug mode
    const embedder = new OllamaEmbeddingFunction({
      model: 'nomic-embed-text',
      host: process.env.OLLAMA_HOST || 'http://localhost:11434',
      debugMode: true,
      debugOptions: {
        saveToFile: true,
        outputDir: './debug-embeddings',
        logFull: false
      }
    });
    
    // Sample texts of different lengths and content
    const texts = [
      "This is a short test sentence.",
      "This is a longer paragraph that contains multiple sentences. It has more semantic content and should generate a different embedding vector compared to the shorter text. The embedding model should capture the additional context provided here.",
      "Technical content: React is a JavaScript library for building user interfaces. It allows developers to create reusable UI components and efficiently update the DOM.",
      "Completely different topic: The Himalayas are a mountain range in Asia separating the plains of the Indian subcontinent from the Tibetan Plateau."
    ];
    
    console.log(`Generating embeddings for ${texts.length} sample texts...`);
    
    // Generate embeddings for all texts (batched internally)
    const embeddings = await embedder.generate(texts);
    
    console.log('Embedding test completed successfully!');
    console.log(`Generated ${embeddings.length} embeddings`);
    console.log(`Vector dimension: ${embeddings[0].length}`);
    
    // Print model information
    console.log(`\nModel information:`);
    console.log(`- Model name: ${embedder.model}`);
    console.log(`- Host: ${embedder.host}`);
    
    // Suggest commands to run with environment variables
    console.log('\nTo enable debugging in your application, run with:');
    console.log('DEBUG_EMBEDDINGS=true npm start');
    console.log('\nTo save embeddings to file:');
    console.log('DEBUG_EMBEDDINGS=true SAVE_EMBEDDINGS=true npm start');
  } catch (error) {
    console.error('Error in embedding test:', error);
  }
}

// Run the test function
testEmbeddings(); 