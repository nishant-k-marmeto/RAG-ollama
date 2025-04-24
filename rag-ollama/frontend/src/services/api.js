import axios from 'axios';

// Set base URL for all API calls
const API_BASE_URL = 'https://ai-tool.marmeto.com/api';

// Create axios instance with base config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 second timeout
});

// Add request interceptor for debugging
api.interceptors.request.use(
  config => {
    console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`, config.data);
    return config;
  },
  error => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
api.interceptors.response.use(
  response => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  error => {
    console.error('API Response Error:', error.message);
    if (error.response) {
      console.error('Error Status:', error.response.status);
      console.error('Error Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received:', error.request);
    }
    return Promise.reject(error);
  }
);

// Document management API functions
const getDocuments = async () => {
  const response = await api.get('/rag/documents');
  return response.data;
};

const addDocument = async (title, content) => {
  const response = await api.post('/rag/add-document', { title, content });
  return response.data;
};

const uploadFiles = async (directory) => {
  const response = await api.post('/rag/upload-files', { directory });
  return response.data;
};

const uploadFilesClient = async (files) => {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }
  
  const response = await api.post('/rag/upload-files-client', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

const deleteAllDocuments = async () => {
  const response = await api.delete('/rag/documents');
  return response.data;
};

const importEmployeeData = async () => {
  const response = await api.post('/rag/import-employee-data');
  return response.data;
};

const syncUtilsDataFiles = async () => {
  const response = await api.post('/rag/sync-utils-data');
  return response.data;
};

// Query functions
const queryWithContext = async (query) => {
  const response = await api.post('/rag/query', { query });
  return response.data;
};

// Chat functions
const sendChatMessage = async (message, conversationId, useChainOfThought = false) => {
  try {
    console.log('Sending chat message with params:', { message, conversationId, useChainOfThought });
    const response = await api.post('/rag/chat', { 
      message,
      conversationId,
      useChainOfThought
    });
    console.log('Chat response received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Chat API error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received - request details:', 
        error.request._currentUrl || error.request.responseURL || 'Unknown URL');
    }
    throw error;
  }
};

const getChatHistory = async (conversationId) => {
  const response = await api.get(`/rag/chat/${conversationId}/history`);
  return response.data;
};

const getConversations = async () => {
  const response = await api.get('/rag/chat/conversations');
  return response.data;
};

const clearConversation = async (conversationId) => {
  const response = await api.delete(`/rag/chat/${conversationId}`);
  return response.data;
};

const clearAllData = async () => {
  const response = await api.delete('/rag/clear-all-data');
  return response.data;
};

// System status
const getChromaStatus = async () => {
  const response = await api.get('/rag/chroma-status');
  return response.data;
};

export default {
  getDocuments,
  addDocument,
  uploadFiles,
  uploadFilesClient,
  deleteAllDocuments,
  importEmployeeData,
  syncUtilsDataFiles,
  queryWithContext,
  sendChatMessage,
  getChatHistory,
  getConversations,
  clearConversation,
  clearAllData,
  getChromaStatus,
  get: api.get,
  post: api.post,
  put: api.put,
  delete: api.delete
}; 