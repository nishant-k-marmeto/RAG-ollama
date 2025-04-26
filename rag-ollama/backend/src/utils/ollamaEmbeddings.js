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
      const batchSize = 5; // Reduced batch size for better reliability
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(texts.length/batchSize)}`);
        
        const batchEmbeddings = await Promise.all(
          batch.map(text => this.generateSingleEmbedding(text))
        );
        embeddings.push(...batchEmbeddings);
        
        // Add a small delay to prevent rate limiting
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Debug batch embeddings if in debug mode
      if (this.debugMode && embeddings.length > 0) {
        console.log(`Running debug analysis on batch of ${embeddings.length} embeddings`);
        debugBatchEmbeddings(texts, embeddings, this.debugOptions);
      }
      
      console.log(`Successfully generated ${embeddings.length} embeddings of dimension ${embeddings[0]?.length || 'unknown'}`);
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
      // Ensure text is not empty and is a string
      if (!text || typeof text !== 'string') {
        console.warn('Invalid text provided for embedding, using empty string instead');
        text = '';
      }
      
      // Trim and prepare text
      const processedText = text.trim().substring(0, 8000); // Limit text length
      
      // Log embedding request
      console.log(`Generating embedding for text: "${processedText.substring(0, 50)}${processedText.length > 50 ? '...' : ''}"`);
      
      // Make request to Ollama
      const response = await this.ollama.embeddings({
        model: this.model,
        prompt: processedText
      });
      
      if (!response || !response.embedding) {
        throw new Error('Invalid response from Ollama: No embedding returned');
      }
      
      // Truncate embedding to 384 dimensions to match expected size in ChromaDB
      // This is needed because the collection was created with this dimension
      const truncatedEmbedding = response.embedding.slice(0, 384);
      
      // Debug individual embedding if in debug mode
      if (this.debugMode) {
        debugEmbedding(processedText, truncatedEmbedding, this.debugOptions);
      }
      
      return truncatedEmbedding;
    } catch (error) {
      console.error(`Error embedding text: "${text?.substring(0, 50)}..."`, error);
      
      // Return a zero vector of appropriate length as fallback
      // This prevents the system from crashing when one embedding fails
      console.warn('Returning zero vector as fallback for failed embedding');
      return new Array(384).fill(0);
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