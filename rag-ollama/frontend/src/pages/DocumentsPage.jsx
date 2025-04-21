import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DocumentsPage = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  // Fetch documents
  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/rag/documents');
        setDocuments(response.data.documents);
      } catch (err) {
        console.error('Error fetching documents:', err);
        setError('Failed to load documents. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  // Handle document addition
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!title.trim() || !content.trim()) {
      setFormError('Title and content are required');
      return;
    }
    
    setFormError(null);
    setFormSuccess(null);
    setLoading(true);
    
    try {
      const response = await axios.post('/api/rag/add-document', { title, content });
      
      // Add new document to state
      setDocuments([...documents, response.data.document]);
      
      // Reset form
      setTitle('');
      setContent('');
      setFormSuccess('Document added successfully');
    } catch (err) {
      console.error('Error adding document:', err);
      setFormError('Failed to add document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="documents-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Knowledge Base Documents</h1>
      </div>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>Add New Document</h2>
        
        {formError && (
          <div style={{ color: 'red', margin: '1rem 0' }}>
            {formError}
          </div>
        )}
        
        {formSuccess && (
          <div style={{ color: 'green', margin: '1rem 0' }}>
            {formSuccess}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="title">Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
            />
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="content">Content</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Document content..."
              rows={6}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading || !title.trim() || !content.trim()}
          >
            {loading ? 'Adding...' : 'Add Document'}
          </button>
        </form>
      </div>
      
      <div>
        <h2>Existing Documents</h2>
        
        {error && (
          <div style={{ color: 'red', margin: '1rem 0' }}>
            {error}
          </div>
        )}
        
        {loading && <p>Loading documents...</p>}
        
        {!loading && documents.length === 0 ? (
          <p>No documents in the knowledge base yet. Add your first document above.</p>
        ) : (
          <div className="documents-list">
            {documents.map((doc) => (
              <div 
                key={doc.id} 
                style={{ 
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  padding: '1rem',
                  marginBottom: '1rem'
                }}
              >
                <h3>{doc.title}</h3>
                <p style={{ 
                  whiteSpace: 'pre-wrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  maxHeight: '100px'
                }}>
                  {doc.content}
                </p>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>
                  Added: {new Date(doc.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsPage;