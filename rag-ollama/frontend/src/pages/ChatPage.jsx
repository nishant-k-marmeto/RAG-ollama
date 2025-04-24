import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import api from '../services/api';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conversationId, setConversationId] = useState(() => {
    // Load from localStorage or generate a new ID
    return localStorage.getItem('chatConversationId') || uuidv4();
  });
  const [useChainOfThought, setUseChainOfThought] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Save conversationId to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('chatConversationId', conversationId);
  }, [conversationId]);
  
  // Load conversation history when component mounts
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.getChatHistory(conversationId);
        if (response.conversation && response.conversation.length > 0) {
          setMessages(response.conversation);
        } else {
          // Add a welcome message if conversation is empty
          setMessages([{
            role: 'assistant',
            content: 'Hello! I\'m your AI assistant. Ask me anything about your documents or use "chain-of-thought" for complex questions.',
            timestamp: new Date().toISOString()
          }]);
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
        // Add a welcome message if history couldn't be loaded
        setMessages([{
          role: 'assistant',
          content: 'Hello! I\'m your AI assistant. Ask me anything about your documents or use "chain-of-thought" for complex questions.',
          timestamp: new Date().toISOString()
        }]);
      }
    };
    
    fetchHistory();
  }, [conversationId]);
  
  // Scroll to bottom of chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Handle sending a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    // Optimistically add user message to UI
    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);
    
    // Add loading indicator message
    setMessages(prev => [...prev, {
      role: 'system',
      content: 'Processing your request...',
      isLoading: true,
      timestamp: new Date().toISOString()
    }]);
    
    try {
      console.log('Sending message to API:', input);
      // The API expects message first, then conversationId
      const response = await api.sendChatMessage(input, conversationId, useChainOfThought);
      console.log('Received API response:', response);
      
      // Remove the loading message
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      
      // Add assistant response to messages
      const assistantMessage = {
        role: 'assistant',
        content: response.answer,
        timestamp: new Date().toISOString(),
        documents: response.documents
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error sending message:', err);
      
      // Remove the loading message
      setMessages(prev => prev.filter(msg => !msg.isLoading));
      
      let errorMessage = 'Failed to get response. Please try again.';
      
      if (err.message && err.message.includes('timeout')) {
        errorMessage = 'The request timed out. The server might be busy or experiencing issues.';
      } else if (err.response) {
        errorMessage = `Server error: ${err.response.status}. ${err.response.data?.error || ''}`;
      } else if (err.request) {
        errorMessage = 'No response received from server. Please check your connection.';
      }
      
      setError(errorMessage);
      
      // Add error message to chat
      setMessages(prev => [...prev, {
        role: 'system',
        content: errorMessage,
        error: true,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };
  
  // Clear conversation history
  const handleClearConversation = async () => {
    try {
      await api.clearConversation(conversationId);
      
      // Start a new conversation
      const newConversationId = uuidv4();
      setConversationId(newConversationId);
      
      // Reset messages with welcome message
      setMessages([{
        role: 'assistant',
        content: 'Conversation cleared. How can I help you today?',
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Error clearing conversation:', error);
      setError('Failed to clear conversation. Please try again.');
    }
  };
  
  // Format message content with proper styling for thinking steps
  const formatMessageContent = (content) => {
    if (!content) return '';
    
    // Split content by thinking sections
    const parts = content.split(/Thinking: /);
    
    if (parts.length === 1) {
      // No thinking sections
      return <p>{content}</p>;
    }
    
    // Format with thinking sections highlighted
    return (
      <>
        <p>{parts[0]}</p>
        {parts.slice(1).map((part, index) => {
          // Find where the thinking section ends (usually a line break)
          const thinkingEndIndex = part.indexOf('\n\n');
          
          if (thinkingEndIndex === -1) {
            // Entire part is thinking
            return (
              <div key={index} className="thinking-section">
                <p><strong>Thinking:</strong> {part}</p>
              </div>
            );
          }
          
          // Split into thinking and rest of content
          const thinking = part.substring(0, thinkingEndIndex);
          const rest = part.substring(thinkingEndIndex);
          
          return (
            <React.Fragment key={index}>
              <div className="thinking-section">
                <p><strong>Thinking:</strong> {thinking}</p>
              </div>
              <p>{rest}</p>
            </React.Fragment>
          );
        })}
      </>
    );
  };
  
  return (
    <div className="chat-page">
      <div className="chat-header">
        <h1>Chat with Your Documents</h1>
        <div className="chat-controls">
          <label className="chain-of-thought-toggle">
            <input
              type="checkbox"
              checked={useChainOfThought}
              onChange={(e) => setUseChainOfThought(e.target.checked)}
            />
            <span>Enable Chain-of-Thought</span>
          </label>
          <button 
            onClick={handleClearConversation}
            className="clear-chat-button"
          >
            Clear Chat
          </button>
        </div>
      </div>
      
      <div className="messages-container">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`message ${message.role} ${message.error ? 'error' : ''} ${message.isLoading ? 'loading' : ''}`}
          >
            <div className="message-content">
              {message.isLoading ? (
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              ) : message.role === 'assistant' ? (
                formatMessageContent(message.content)
              ) : (
                <p>{message.content}</p>
              )}
              
              {message.documents && message.documents.length > 0 && (
                <div className="message-documents">
                  <p><strong>Sources:</strong></p>
                  <ul>
                    {message.documents.map((doc, i) => (
                      <li key={i}>{doc.title}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && !messages.some(m => m.isLoading) && (
          <div className="message assistant loading">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </form>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <style jsx>{`
        .chat-page {
          display: flex;
          flex-direction: column;
          height: 90vh;
          max-width: 900px;
          margin: 0 auto;
          padding: 1rem;
        }
        
        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .chat-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .chain-of-thought-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }
        
        .clear-chat-button {
          background-color: #f44336;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
        }
        
        .message {
        background-color: gray;
          margin-bottom: 1rem;
          padding: 1rem;
          border-radius: 8px;
          max-width: 80%;
        }
        
        .message.user {
        background-color: olivedrab;
          margin-left: auto;
        }
        
        .message.assistant {
        
          margin-right: auto;
        }
        
        .message.system, .message.error {
         
          margin: 0 auto;
          text-align: center;
        }
        
        .message-content p {
          margin: 0 0 0.5rem 0;
        }
        
        .thinking-section {
          background-color: #e8f5e9;
          padding: 0.5rem;
          border-radius: 4px;
          margin: 0.5rem 0;
        }
        
        .message-documents {
          font-size: 0.8rem;
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid #e0e0e0;
        }
        
        .message-documents ul {
          margin: 0;
          padding-left: 1.5rem;
        }
        
        .chat-input-form {
          display: flex;
          gap: 0.5rem;
        }
        
        .chat-input-form input {
          flex: 1;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
        }
        
        .chat-input-form button {
          padding: 0.75rem 1.5rem;
          background-color: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .chat-input-form button:disabled {
          background-color: #bdbdbd;
          cursor: not-allowed;
        }
        
        .typing-indicator {
          display: flex;
          gap: 0.25rem;
        }
        
        .typing-indicator span {
          width: 8px;
          height: 8px;
          background-color: #bdbdbd;
          border-radius: 50%;
          display: inline-block;
          animation: bounce 1.5s infinite ease-in-out;
        }
        
        .typing-indicator span:nth-child(1) {
          animation-delay: 0s;
        }
        
        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
        }
        
        .error-message {
          color: #f44336;
          margin-top: 0.5rem;
          text-align: center;
        }
      `}</style>
    </div>
  );
};

export default ChatPage; 