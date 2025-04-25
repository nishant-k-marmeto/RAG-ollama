import fs from 'fs';
import path from 'path';

/**
 * Debug utility to print and optionally save embeddings
 * @param {string} text - The original text that was embedded
 * @param {number[]} embedding - The embedding vector
 * @param {object} options - Debug options
 * @param {boolean} options.saveToFile - Whether to save embeddings to file
 * @param {string} options.outputDir - Directory to save embeddings (defaults to ./debug-embeddings)
 * @param {boolean} options.logFull - Whether to log the full embedding vector
 * @returns {void}
 */
export function debugEmbedding(text, embedding, options = {}) {
  const {
    saveToFile = false,
    outputDir = './debug-embeddings',
    logFull = false
  } = options;

  // Create a shortened preview of the text
  const textPreview = text.length > 50 ? `${text.substring(0, 50)}...` : text;
  
  // Print embedding information
  console.log(`----- EMBEDDING DEBUG -----`);
  console.log(`Text: ${textPreview}`);
  console.log(`Embedding dimension: ${embedding.length}`);
  
  // Print vector stats
  const stats = calculateEmbeddingStats(embedding);
  console.log(`Stats: min=${stats.min.toFixed(4)}, max=${stats.max.toFixed(4)}, mean=${stats.mean.toFixed(4)}, std=${stats.std.toFixed(4)}`);
  
  // Print sample of vector values
  const sampleSize = 5;
  console.log(`Sample values: [${embedding.slice(0, sampleSize).map(v => v.toFixed(4)).join(', ')}${logFull ? '' : '...'}`);
  
  // Print full vector if requested
  if (logFull) {
    console.log(`Full embedding: [${embedding.map(v => v.toFixed(6)).join(', ')}]`);
  }
  
  // Save to file if requested
  if (saveToFile) {
    saveEmbeddingToFile(text, embedding, outputDir);
  }
  
  console.log(`--------------------------`);
}

/**
 * Save an embedding to a JSON file for later analysis
 * @param {string} text - The original text
 * @param {number[]} embedding - The embedding vector
 * @param {string} outputDir - Directory to save the file
 */
function saveEmbeddingToFile(text, embedding, outputDir) {
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Create a filename based on a hash of the text
    const fileName = `embedding-${Date.now()}-${Math.floor(Math.random() * 10000)}.json`;
    const filePath = path.join(outputDir, fileName);
    
    // Prepare data to save
    const data = {
      text: text,
      embedding: embedding,
      metadata: {
        dimension: embedding.length,
        timestamp: new Date().toISOString(),
        stats: calculateEmbeddingStats(embedding)
      }
    };
    
    // Write to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Embedding saved to ${filePath}`);
  } catch (error) {
    console.error('Error saving embedding to file:', error);
  }
}

/**
 * Calculate basic statistics for an embedding vector
 * @param {number[]} embedding - The embedding vector
 * @returns {object} Statistics including min, max, mean, std
 */
function calculateEmbeddingStats(embedding) {
  const min = Math.min(...embedding);
  const max = Math.max(...embedding);
  const sum = embedding.reduce((a, b) => a + b, 0);
  const mean = sum / embedding.length;
  
  // Calculate standard deviation
  const squaredDifferences = embedding.map(x => Math.pow(x - mean, 2));
  const variance = squaredDifferences.reduce((a, b) => a + b, 0) / embedding.length;
  const std = Math.sqrt(variance);
  
  return { min, max, mean, std };
}

/**
 * Debug utility for batch embeddings
 * @param {string[]} texts - Array of texts that were embedded
 * @param {number[][]} embeddings - Array of embedding vectors
 * @param {object} options - Debug options
 */
export function debugBatchEmbeddings(texts, embeddings, options = {}) {
  console.log(`===== BATCH EMBEDDINGS DEBUG =====`);
  console.log(`Total embeddings: ${embeddings.length}`);
  
  if (embeddings.length > 0) {
    console.log(`Dimension: ${embeddings[0].length}`);
    
    // Calculate similarities between first embedding and all others
    if (embeddings.length > 1) {
      console.log(`Similarity analysis (cosine similarity to first embedding):`);
      
      for (let i = 1; i < Math.min(embeddings.length, 5); i++) {
        const similarity = calculateCosineSimilarity(embeddings[0], embeddings[i]);
        console.log(`  Text ${i+1} similarity: ${similarity.toFixed(4)}`);
      }
    }
  }
  
  // Log individual embeddings with limited detail
  for (let i = 0; i < Math.min(embeddings.length, 3); i++) {
    const embeddingOptions = { ...options, logFull: false };
    debugEmbedding(texts[i], embeddings[i], embeddingOptions);
  }
  
  console.log(`==================================`);
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} v1 - First vector
 * @param {number[]} v2 - Second vector
 * @returns {number} Cosine similarity (-1 to 1)
 */
function calculateCosineSimilarity(v1, v2) {
  if (v1.length !== v2.length) {
    throw new Error('Vectors must have the same dimension');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
    normA += v1[i] * v1[i];
    normB += v2[i] * v2[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
} 