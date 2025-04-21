import axios from 'axios';

const api = {
  // Query the RAG system
  async queryRag(query) {
    const response = await axios.post('/api/rag/query', { query });
    return response.data;
  },

  // Query the RAG system with streaming response
  streamQueryRag(query, onChunk, onDocuments, onError) {
    const eventSource = new EventSource(`/api/rag/query/stream?query=${encodeURIComponent(query)}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.error) {
        onError(data.error);
        eventSource.close();
      } else if (data.done) {
        onDocuments(data.documents || []);
        eventSource.close();
      } else if (data.chunk) {
        onChunk(data.chunk);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      onError('Connection error. Please try again.');
      eventSource.close();
    };
    
    return () => {
      eventSource.close();
    };
  },
  
  // Add a document to the knowledge base
  async addDocument(title, content) {
    const response = await axios.post('/api/rag/add-document', { title, content });
    return response.data;
  },
  
  // Get all documents
  async getDocuments() {
    const response = await axios.get('/api/rag/documents');
    return response.data;
  }
};

export default api; 