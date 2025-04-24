import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const HomePage = () => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [streamingResponse, setStreamingResponse] = useState('');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useStreaming, setUseStreaming] = useState(true);
  
  // Reference to manage the EventSource
  const eventSourceRef = useRef(null);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current();
      }
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    
    if (useStreaming) {
      // Clean up previous stream if exists
      if (eventSourceRef.current) {
        eventSourceRef.current();
      }
      
      setStreamingResponse('');
      setDocuments([]);
      
      // Setup streaming
      eventSourceRef.current = api.streamQueryRag(
        query,
        // On chunk received
        (chunk) => {
          setStreamingResponse(prev => prev + chunk);
        },
        // On documents received (end of stream)
        (docs) => {
          setDocuments(docs);
          setLoading(false);
        },
        // On error
        (err) => {
          setError(err);
          setLoading(false);
        }
      );
    } else {
      try {
        const result = await api.queryRag(query);
        setResponse(result.response);
      } catch (err) {
        console.error('Error querying:', err);
        setError('Failed to get response. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleStreamingMode = () => {
    setUseStreaming(!useStreaming);
    // Reset responses when switching modes
    setResponse(null);
    setStreamingResponse('');
    setDocuments([]);
  };

  return (
    <div className="home-page">
      <h1>RAG Q&A System</h1>
      <p>Ask a question and get answers based on your knowledge base.</p>
      
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={useStreaming} 
            onChange={toggleStreamingMode} 
            style={{ marginRight: '0.5rem' }}
          />
          Use streaming responses
        </label>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question..."
            rows={4}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading || !query.trim()}
        >
          {loading ? 'Getting Answer...' : 'Submit Question'}
        </button>
      </form>
      
      {error && (
        <div style={{ color: 'red', margin: '1rem 0' }}>
          {error}
        </div>
      )}
      
      {/* Regular response display */}
      {!useStreaming && response && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Answer</h2>
          <div style={{ 
            backgroundColor: '#f0f0f0', 
            padding: '1rem', 
            borderRadius: '4px',
            whiteSpace: 'pre-wrap'
          }}>
            {response.answer}
          </div>
          
          {response.documents && response.documents.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3>Sources</h3>
              <ul>
                {response.documents.map((doc) => (
                  <li key={doc.id}>{doc.title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {/* Streaming response display */}
      {useStreaming && (streamingResponse || loading) && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Answer {loading && <small>(streaming...)</small>}</h2>
          <div style={{ 
            padding: '1rem', 
            borderRadius: '4px',
            whiteSpace: 'pre-wrap'
          }}>
            {streamingResponse || 'Waiting for response...'}
            {loading && <span className="cursor">▋</span>}
          </div>
          
          {documents.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3>Sources</h3>
              <ul>
                {documents.map((doc) => (
                  <li key={doc.id}>{doc.title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HomePage; 