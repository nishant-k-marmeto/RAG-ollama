import { Ollama } from 'ollama';
import { getOrCreateCollection, queryCollection } from '../utils/chromadb.js';

// Initialize Ollama client
const ollama = new Ollama();

// Collection name for ChromaDB
const COLLECTION_NAME = 'rag_documents';

/**
 * Simple document similarity search for retrieval
 * In a real application, you would use a proper vector DB
 */
const findRelevantDocuments = (query, documents) => {
  if (!documents.length) return [];
  
  // Simple keyword matching (not ideal, but works for demo)
  const keywords = query.toLowerCase().split(' ');
  
  return documents
    .map(doc => {
      const content = doc.content.toLowerCase();
      const title = doc.title.toLowerCase();
      
      // Calculate a simple relevance score
      const score = keywords.reduce((acc, keyword) => {
        return acc + 
          (content.includes(keyword) ? 1 : 0) + 
          (title.includes(keyword) ? 0.5 : 0);
      }, 0);
      
      return { ...doc, score };
    })
    .filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3); // Return top 3 most relevant docs
};

/**
 * Generate a response using RAG (Retrieval Augmented Generation)
 * @param {string} query - User query
 * @param {Array} documents - Legacy documents (used as fallback)
 * @returns {Object} - Response with answer and documents used
 */
const generateResponse = async (query, documents) => {
  try {
    // Try to get relevant documents from ChromaDB
    let relevantDocs = [];
    let useChroma = false;
    let context = '';
    
    try {
      const collection = await getOrCreateCollection(COLLECTION_NAME);
      const results = await queryCollection(collection, 3, [query]);
      
      if (results.documents && results.documents[0] && results.documents[0].length > 0) {
        useChroma = true;
        // Format documents from ChromaDB
        context = results.documents[0].join('\n\n');
        
        // Map the documents for response
        relevantDocs = results.documents[0].map((doc, index) => ({
          id: results.ids[0][index],
          title: results.metadatas[0][index]?.source || `Document ${index + 1}`,
          content: doc.substring(0, 100) + '...' // Just to keep the response lighter
        }));
      }
    } catch (error) {
      console.error('Error querying ChromaDB:', error);
      // Fall back to the legacy method
      useChroma = false;
    }
    
    // If ChromaDB failed or had no results, fall back to the legacy method
    if (!useChroma) {
      console.log('Falling back to legacy document retrieval');
      // Use the legacy document finding method
      relevantDocs = findRelevantDocuments(query, documents);
      
      if (relevantDocs.length === 0) {
        const response = await ollama.chat({
          model: 'gemma3:1b',
          messages: [{ role: 'user', content: query }],
        });
        
        return {
          answer: response.message.content,
          documents: []
        };
      }
      
      // Format documents as context
      context = relevantDocs.map(doc => `Document Title: ${doc.title}\nContent: ${doc.content}`).join('\n\n');
    }

    // Create a prompt with the context
    const systemPrompt = `You are a helpful AI assistant. Use the following context to answer the question.
If the answer is not in the context, just say "I don't have enough information to answer this question" and suggest what other information would be helpful.`;

    const userPrompt = `Context:
${context}

Question: ${query}`;

    // Generate the response using ollama
    const response = await ollama.chat({
      model: 'gemma3:1b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });
    
    return {
      answer: response.message.content,
      documents: relevantDocs.map(doc => {
        if (typeof doc.id !== 'undefined') {
          return { id: doc.id, title: doc.title };
        }
        return doc;
      })
    };
  } catch (error) {
    console.error('Error generating RAG response:', error);
    throw new Error('Failed to generate response: ' + error.message);
  }
};

/**
 * Generate a streaming response using RAG
 * @param {string} query - User query
 * @param {Array} documents - Legacy documents (used as fallback)
 * @param {Function} onChunk - Callback for each chunk received
 * @returns {Array} - Info about documents used
 */
const streamGenerateResponse = async (query, documents, onChunk) => {
  try {
    // Try to get relevant documents from ChromaDB
    let relevantDocs = [];
    let useChroma = false;
    let context = '';
    
    try {
      const collection = await getOrCreateCollection(COLLECTION_NAME);
      const results = await queryCollection(collection, 3, [query]);
      
      if (results.documents && results.documents[0] && results.documents[0].length > 0) {
        useChroma = true;
        // Format documents from ChromaDB
        context = results.documents[0].join('\n\n');
        
        // Map the documents for response
        relevantDocs = results.documents[0].map((doc, index) => ({
          id: results.ids[0][index],
          title: results.metadatas[0][index]?.source || `Document ${index + 1}`,
          content: doc.substring(0, 100) + '...' // Just to keep the response lighter
        }));
      }
    } catch (error) {
      console.error('Error querying ChromaDB:', error);
      // Fall back to the legacy method
      useChroma = false;
    }
    
    // If ChromaDB failed or had no results, fall back to the legacy method
    if (!useChroma) {
      console.log('Falling back to legacy document retrieval');
      // Use the legacy document finding method
      relevantDocs = findRelevantDocuments(query, documents);
      
      if (relevantDocs.length === 0) {
        const response = await ollama.chat({
          model: 'gemma3:1b',
          messages: [{ role: 'user', content: query }],
          stream: true
        });
        
        for await (const part of response) {
          onChunk(part.message.content);
        }
        
        return [];
      }
      
      // Format documents as context
      context = relevantDocs.map(doc => `Document Title: ${doc.title}\nContent: ${doc.content}`).join('\n\n');
    }
    
    // Create a prompt with the context
    const systemPrompt = `You are a helpful AI assistant. Use the following context to answer the question. Please answer in elaborative manner and always use bullets and points when answering questions.
If the answer is not in the context, just say "I don't have enough information to answer this question" and suggest what other information would be helpful.`;

    const userPrompt = `Context:
${context}

Question: ${query}`;

    // Generate the streaming response using ollama
    const response = await ollama.chat({
      model: 'gemma3:1b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: true
    });
    
    for await (const part of response) {
      onChunk(part.message.content);
    }
    
    return relevantDocs.map(doc => {
      if (typeof doc.id !== 'undefined') {
        return { id: doc.id, title: doc.title };
      }
      return doc;
    });
  } catch (error) {
    console.error('Error generating streaming RAG response:', error);
    throw new Error('Failed to generate streaming response: ' + error.message);
  }
};

export { generateResponse, streamGenerateResponse }; 