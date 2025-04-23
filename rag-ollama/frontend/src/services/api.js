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
  
  // Upload files to the knowledge base
  async uploadFiles(directory) {
    const response = await axios.post('/api/rag/upload-files', { directory });
    return response.data;
  },
  
  // Import employee attendance data
  async importEmployeeData() {
    const response = await axios.post('/api/rag/import-employee-data');
    return response.data;
  },
  
  // Sync files from utils-data directory
  async syncUtilsDataFiles() {
    const response = await axios.post('/api/rag/sync-utils-data');
    return response.data;
  },
  
  // Delete all documents from the knowledge base
  async deleteAllDocuments() {
    const response = await axios.delete('/api/rag/documents');
    return response.data;
  },
  
  // Get all documents
  async getDocuments() {
    const response = await axios.get('/api/rag/documents');
    return response.data;
  },
  
  // Chat with the model
  async sendChatMessage(message, conversationId, useChainOfThought = false) {
    const response = await axios.post('/api/rag/chat', {
      message,
      conversationId,
      useChainOfThought
    });
    return response.data;
  },
  
  // Get chat history for a conversation
  async getChatHistory(conversationId) {
    const response = await axios.get(`/api/rag/chat/${conversationId}/history`);
    return response.data;
  },
  
  // Clear a conversation
  async clearChatHistory(conversationId) {
    const response = await axios.delete(`/api/rag/chat/${conversationId}`);
    return response.data;
  }
};

export default api; 