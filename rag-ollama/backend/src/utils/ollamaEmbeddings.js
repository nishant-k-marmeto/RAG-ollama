import { Ollama } from 'ollama';
import { debugEmbedding, debugBatchEmbeddings } from './debugUtils.js';

/**
 * Custom embedding function for ChromaDB that uses Ollama's nomic-embed-text model
 */
export class OllamaEmbeddingFunction {
  constructor(options = {}) {
    this.model = options.model || 'nomic-embed-text';
    this.host = options.host || process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.debugMode = options.debugMode || false;
    this.debugOptions = options.debugOptions || {};
    
    // Create Ollama client with connection pooling
    this.ollama = new Ollama({
      host: this.host,
      keepAlive: true,
      keepAliveMsecs: 300000, // 5 minutes
      headers: { 'Connection': 'keep-alive' }
    });
    
    console.log(`Initialized Ollama embedding function with model: ${this.model}, host: ${this.host}, debug: ${this.debugMode}`);
  }

  /**
   * Generate embeddings for documents using Ollama
   * @param {string[]} texts - Array of text strings to embed
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async generate(texts) {
    try {
      console.log(`Generating embeddings for ${texts.length} documents using Ollama (${this.model})`);
      
      // Process texts in batches to avoid overloading Ollama
      const embeddings = [];
      const batchSize = 10;
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchEmbeddings = await Promise.all(
          batch.map(text => this.generateSingleEmbedding(text))
        );
        embeddings.push(...batchEmbeddings);
        
        // Add a small delay to prevent rate limiting
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Debug batch embeddings if in debug mode
      if (this.debugMode && embeddings.length > 0) {
        console.log(`Running debug analysis on batch of ${embeddings.length} embeddings`);
        debugBatchEmbeddings(texts, embeddings, this.debugOptions);
      }
      
      return embeddings;
    } catch (error) {
      console.error('Error generating Ollama embeddings:', error);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }
  
  /**
   * Generate embedding for a single text using Ollama
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} - Embedding vector
   */
  async generateSingleEmbedding(text) {
    try {
      const response = await this.ollama.embeddings({
        model: this.model,
        prompt: text.trim()
      });
      
      if (!response || !response.embedding) {
        throw new Error('Invalid response from Ollama: No embedding returned');
      }
      
      // Debug individual embedding if in debug mode
      if (this.debugMode) {
        debugEmbedding(text, response.embedding, this.debugOptions);
      }
      
      return response.embedding;
    } catch (error) {
      console.error(`Error embedding text: "${text.substring(0, 50)}..."`, error);
      throw error;
    }
  }

  /**
   * Enable debugging mode
   * @param {object} options - Debug options
   */
  enableDebug(options = {}) {
    this.debugMode = true;
    this.debugOptions = options;
    console.log('Embedding debug mode enabled with options:', options);
  }

  /**
   * Disable debugging mode
   */
  disableDebug() {
    this.debugMode = false;
    console.log('Embedding debug mode disabled');
  }
} 