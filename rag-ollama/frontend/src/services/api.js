import axios from 'axios';

// Log when the API service is loaded
console.log('API service initializing...');

// Set base URL for all API calls - log it for debugging
const API_BASE_URL = 'https://ai-tool.marmeto.com/api';
console.log('API_BASE_URL:', API_BASE_URL);

// Create axios instance with base config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 3000 
});

// Log the created instance
console.log('Axios instance created with baseURL:', api.defaults.baseURL);

// Override axios to log the full request URL
const originalRequest = axios.Axios.prototype.request;
axios.Axios.prototype.request = function(...args) {
  const config = args[0];
  const fullUrl = config.baseURL + config.url;
  console.log(`🔍 AXIOS FULL URL: ${config.method?.toUpperCase() || 'GET'} ${fullUrl}`);
  return originalRequest.apply(this, args);
};

// Add request interceptor for debugging
api.interceptors.request.use(
  config => {
    const fullUrl = config.baseURL + config.url;
    console.log(`🚀 API Request: ${config.method.toUpperCase()} ${fullUrl} (${new Date().toISOString()})`);
    console.log('Request headers:', config.headers);
    console.log('Request data:', config.data);
    
    // Force baseURL to be correct (extra safety measure)
    config.baseURL = API_BASE_URL;
    
    return config;
  },
  error => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
api.interceptors.response.use(
  response => {
    const fullUrl = response.config.baseURL + response.config.url;
    console.log(`✅ API Response ${response.status}: ${fullUrl} (${new Date().toISOString()})`);
    
    // Only log first 500 characters of response to avoid console flooding
    const responseData = JSON.stringify(response.data).substring(0, 500);
    console.log(`Response data: ${responseData}${JSON.stringify(response.data).length > 500 ? '...(truncated)' : ''}`);
    
    return response;
  },
  error => {
    console.error('❌ API Response Error:', error.message);
    
    if (error.response) {
      console.error('Error Status:', error.response.status);
      console.error('Error Data:', error.response.data);
      console.error('Request URL:', error.config.url);
      console.error('Full URL:', error.config.baseURL + error.config.url);
    } else if (error.request) {
      console.error('No response received for request:', error.request);
      console.error('Request config:', error.config);
      console.error('Full URL that failed:', error.config?.baseURL + error.config?.url);
    }
    
    console.error('Error stack:', error.stack);
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

// Legacy function name to maintain compatibility with HomePage
const queryRag = async (query) => {
  return queryWithContext(query);
};

// Stream query function for HomePage
const streamQueryRag = (query, onChunk, onDocuments, onError) => {
  try {
    console.log('Starting streaming query:', query);
    
    // Create EventSource for SSE connection
    const eventSource = new EventSource(`${API_BASE_URL}/rag/query/stream?query=${encodeURIComponent(query)}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Streaming data received:', data);
        
        if (data.error) {
          console.error('Stream error:', data.error);
          onError(data.error);
          eventSource.close();
        } else if (data.done) {
          console.log('Stream complete, documents:', data.documents);
          onDocuments(data.documents || []);
          eventSource.close();
        } else if (data.chunk) {
          onChunk(data.chunk);
        }
      } catch (err) {
        console.error('Error parsing stream data:', err, event.data);
        onError('Error processing response data');
        eventSource.close();
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      onError('Connection error. Please try again.');
      eventSource.close();
    };
    
    // Return a cleanup function
    return () => {
      console.log('Closing EventSource connection');
      eventSource.close();
    };
  } catch (error) {
    console.error('Error setting up streaming:', error);
    onError('Failed to setup streaming connection');
    return () => {}; // Return empty cleanup function
  }
};

// Chat functions
const sendChatMessage = async (message, conversationId, useChainOfThought = false) => {
  try {
    console.log('🔵 sendChatMessage called with:');
    console.log('- message:', message);
    console.log('- conversationId:', conversationId);
    console.log('- useChainOfThought:', useChainOfThought);
    console.log('- API_BASE_URL:', API_BASE_URL);
    console.log('- api.defaults.baseURL:', api.defaults.baseURL);
    
    // Construct the URL manually for debugging
    const chatEndpoint = '/rag/chat';
    const fullUrl = API_BASE_URL + chatEndpoint;
    console.log('🔍 Full URL that will be used:', fullUrl);
    
    // Create payload
    const payload = { 
      message,
      conversationId,
      useChainOfThought
    };
    console.log('📦 Request payload:', payload);
    
    // Make the request with explicit URL to avoid any proxy issues
    console.log('⏳ Sending request to:', fullUrl);
    const response = await axios({
      method: 'post',
      url: fullUrl,
      data: payload,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 6000000
    });
    
    console.log('✅ Chat response received from:', fullUrl);
    console.log('📋 Response status:', response.status);
    console.log('📊 Response data:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('❌ Chat API error:', error.message);
    console.error('📑 Error details:');
    
    if (error.response) {
      console.error('- Status:', error.response.status);
      console.error('- Data:', error.response.data);
      console.error('- Headers:', error.response.headers);
    } else if (error.request) {
      console.error('- No response received');
      console.error('- Request:', error.request._currentUrl || error.request.responseURL || 'Unknown URL');
      console.error('- Content:', error.request);
    }
    
    console.error('- Config:', error.config);
    console.error('- Stack:', error.stack);
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
  queryRag,
  streamQueryRag,
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