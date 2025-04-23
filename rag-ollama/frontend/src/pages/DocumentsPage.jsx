import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../services/api';

const DocumentsPage = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Form state for manual document input
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  
  // File upload state
  const [directoryPath, setDirectoryPath] = useState('');
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // File upload state for client-side file upload
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Employee data import state
  const [employeeImportLoading, setEmployeeImportLoading] = useState(false);
  const [employeeImportSuccess, setEmployeeImportSuccess] = useState(null);
  const [employeeImportError, setEmployeeImportError] = useState(null);
  const [csvImportLoading, setCsvImportLoading] = useState(false);
  const [csvImportSuccess, setCsvImportSuccess] = useState(null);
  const [csvImportError, setCsvImportError] = useState(null);
  const [chromaStatus, setChromaStatus] = useState(null);
  const [chromaLoading, setChromaLoading] = useState(false);
  const [chromaImportLoading, setChromaImportLoading] = useState(false);
  const [chromaImportSuccess, setChromaImportSuccess] = useState(null);
  const [chromaImportError, setChromaImportError] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch documents
  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      try {
        const response = await api.getDocuments();
        setDocuments(response.documents);
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
      const response = await api.addDocument(title, content);
      
      // Add new document to state
      setDocuments([...documents, response.document]);
      
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
  
  // Handle file upload
  const handleFileUpload = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!directoryPath.trim()) {
      setUploadError('Directory path is required');
      return;
    }
    
    setUploadError(null);
    setUploadSuccess(null);
    setUploadLoading(true);
    
    try {
      const response = await api.uploadFiles(directoryPath);
      setUploadSuccess(`${response.message} (${response.count} files)`);
      
      // Refresh documents
      const docsResponse = await api.getDocuments();
      setDocuments(docsResponse.documents);
      
      // Reset form
      setDirectoryPath('');
    } catch (err) {
      console.error('Error uploading files:', err);
      setUploadError(err.response?.data?.error || 'Failed to upload files. Please check the path and try again.');
    } finally {
      setUploadLoading(false);
    }
  };

  // Handle file change for client-side file upload
  const handleFileChange = (e) => {
    const files = e.target.files;
    const selected = [];
    for (let i = 0; i < files.length; i++) {
      selected.push(files[i]);
    }
    setSelectedFiles(selected);
  };

  // Handle file upload for client-side file upload
  const handleFileUploadClient = async (e) => {
    e.preventDefault();
    
    if (!selectedFiles.length) {
      setUploadError('No files selected');
      return;
    }
    
    setUploadError(null);
    setUploadSuccess(null);
    setUploadLoading(true);
    
    try {
      const response = await api.uploadFilesClient(selectedFiles);
      setUploadSuccess(`${response.message} (${response.count} files)`);
      
      // Refresh documents
      const docsResponse = await api.getDocuments();
      setDocuments(docsResponse.documents);
      
      // Reset form
      setSelectedFiles([]);
    } catch (err) {
      console.error('Error uploading files:', err);
      setUploadError(err.response?.data?.error || 'Failed to upload files. Please try again.');
    } finally {
      setUploadLoading(false);
    }
  };

  // Handle employee data import
  const handleEmployeeDataImport = async () => {
    setEmployeeImportLoading(true);
    setEmployeeImportSuccess(null);
    setEmployeeImportError(null);
    
    try {
      const response = await api.importEmployeeData();
      setEmployeeImportSuccess(`${response.message} (${response.chunks} chunks)`);
      
      // Refresh documents
      const docsResponse = await api.getDocuments();
      setDocuments(docsResponse.documents);
    } catch (err) {
      console.error('Error importing employee data:', err);
      setEmployeeImportError(err.response?.data?.error || 'Failed to import employee data');
    } finally {
      setEmployeeImportLoading(false);
    }
  };

  // Handle utils-data directory sync
  const handleSyncUtilsData = async () => {
    setSyncLoading(true);
    setSyncSuccess(null);
    setSyncError(null);
    
    try {
      const response = await api.syncUtilsDataFiles();
      setSyncSuccess(`${response.message} (${response.totalChunks} chunks from ${response.files.length} files)`);
      
      // Refresh documents
      const docsResponse = await api.getDocuments();
      setDocuments(docsResponse.documents);
    } catch (err) {
      console.error('Error syncing utils-data files:', err);
      setSyncError(err.response?.data?.error || 'Failed to sync utils-data files');
    } finally {
      setSyncLoading(false);
    }
  };
  
  // Handle delete all documents
  const handleDeleteAllDocuments = async () => {
    setDeleteLoading(true);
    setDeleteSuccess(null);
    setDeleteError(null);
    
    try {
      const response = await api.deleteAllDocuments();
      setDeleteSuccess(response.message);
      
      // Refresh documents (should be empty now)
      setDocuments([]);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting all documents:', err);
      setDeleteError(err.response?.data?.error || 'Failed to delete documents');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Import CSV directly to ChromaDB
  const importCSVToChromaDB = async () => {
    setChromaImportLoading(true);
    setChromaImportSuccess(null);
    setChromaImportError(null);
    
    try {
      const response = await axios.post('http://localhost:5000/api/rag/import-csv-to-chroma');
      
      setChromaImportSuccess(`Successfully imported CSV to ChromaDB collection "${response.data.collection}" with ID: ${response.data.documentId}`);
      
      // Refresh documents list
      const docsResponse = await api.getDocuments();
      setDocuments(docsResponse.documents);
    } catch (err) {
      console.error('Error importing CSV to ChromaDB:', err);
      setChromaImportError(err.response?.data?.details || err.message);
    } finally {
      setChromaImportLoading(false);
    }
  };

  // Test ChromaDB connection
  const testChromaDB = async () => {
    setChromaLoading(true);
    setChromaStatus(null);
    
    try {
      const response = await axios.get('http://localhost:5000/api/rag/test-chroma');
      setChromaStatus({
        success: true,
        message: response.data.message,
        details: `Collection: ${response.data.collection}, Documents: ${response.data.documentCount}`
      });
    } catch (err) {
      console.error('ChromaDB test failed:', err);
      setChromaStatus({
        success: false,
        message: 'ChromaDB connection failed',
        details: err.response?.data?.details || err.message
      });
    } finally {
      setChromaLoading(false);
    }
  };

  // Handle CSV file import
  const handleCSVDataImport = async () => {
    setCsvImportLoading(true);
    setCsvImportSuccess(null);
    setCsvImportError(null);
    
    try {
      const response = await axios.post('http://localhost:5000/api/rag/add-document', {
        title: 'Employee Attendance CSV Data',
        content: await fetchCSVContent()
      });
      
      setCsvImportSuccess('Employee CSV data added successfully');
      
      // Refresh documents
      const docsResponse = await api.getDocuments();
      setDocuments(docsResponse.documents);
    } catch (err) {
      console.error('Error importing CSV data:', err);
      setCsvImportError(err.response?.data?.error || 'Failed to import CSV data');
    } finally {
      setCsvImportLoading(false);
    }
  };

  // Fetch CSV content
  const fetchCSVContent = async () => {
    try {
      // Read the CSV file on the backend
      const response = await axios.get('http://localhost:5000/api/rag/utils-data-content', {
        params: { filename: 'Employee-present_absent-status.csv' }
      });
      return response.data.content;
    } catch (error) {
      console.error('Error fetching CSV content:', error);
      throw error;
    }
  };

  return (
    <div className="documents-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Knowledge Base Documents</h1>
      </div>
      
      {/* Manual document addition */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem',  borderRadius: '8px' }}>
        <h2>Add Document Manually</h2>
        
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
      
      {/* File upload section */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem',  borderRadius: '8px' }}>
        <h2>Upload Files (PDF, CSV)</h2>
        <p>Enter the directory path containing your documents on the server.</p>
        
        {uploadError && (
          <div style={{ color: 'red', margin: '1rem 0' }}>
            {uploadError}
          </div>
        )}
        
        {uploadSuccess && (
          <div style={{ color: 'green', margin: '1rem 0' }}>
            {uploadSuccess}
          </div>
        )}
        
        <form onSubmit={handleFileUpload}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="directory">Directory Path</label>
            <input
              id="directory"
              type="text"
              value={directoryPath}
              onChange={(e) => setDirectoryPath(e.target.value)}
              placeholder="/path/to/documents"
            />
            <small style={{ display: 'block', marginTop: '0.5rem', color: '#666' }}>
              Example: /Users/username/documents or backend/docs
            </small>
          </div>
          
          <button 
            type="submit" 
            disabled={uploadLoading || !directoryPath.trim()}
          >
            {uploadLoading ? 'Uploading...' : 'Upload Documents'}
          </button>
        </form>
      </div>
      
      {/* Sync utils-data directory */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
        <h2>Sync Files from utils-data Directory</h2>
        <p>This will scan the backend's utils-data directory and add all compatible files (CSV, TXT) to the knowledge base.</p>
        
        {syncError && (
          <div style={{ color: 'red', margin: '1rem 0' }}>
            {syncError}
          </div>
        )}
        
        {syncSuccess && (
          <div style={{ color: 'green', margin: '1rem 0' }}>
            {syncSuccess}
          </div>
        )}
        
        <button 
          onClick={handleSyncUtilsData}
          disabled={syncLoading}
          style={{ 
            backgroundColor: '#2196F3', 
            color: 'white', 
            padding: '10px 20px', 
            cursor: 'pointer', 
            border: 'none', 
            borderRadius: '4px' 
          }}
        >
          {syncLoading ? 'Syncing...' : 'Sync utils-data Files'}
        </button>
      </div>
      
      {/* Delete all documents section */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '8px', border: '1px solid #f44336' }}>
        <h2>Delete All Documents</h2>
        <p>This will permanently delete all documents from the knowledge base (ChromaDB and in-memory storage).</p>
        
        {deleteError && (
          <div style={{ color: 'red', margin: '1rem 0' }}>
            {deleteError}
          </div>
        )}
        
        {deleteSuccess && (
          <div style={{ color: 'green', margin: '1rem 0' }}>
            {deleteSuccess}
          </div>
        )}
        
        {showDeleteConfirm ? (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ color: '#f44336', fontWeight: 'bold' }}>
              Are you sure? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button 
                onClick={handleDeleteAllDocuments}
                disabled={deleteLoading}
                style={{ 
                  backgroundColor: '#f44336', 
                  color: 'white', 
                  padding: '10px 20px', 
                  cursor: 'pointer', 
                  border: 'none', 
                  borderRadius: '4px' 
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete All Documents'}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                style={{ 
                  backgroundColor: '#9e9e9e', 
                  color: 'white', 
                  padding: '10px 20px', 
                  cursor: 'pointer', 
                  border: 'none', 
                  borderRadius: '4px' 
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            style={{ 
              backgroundColor: '#f44336', 
              color: 'white', 
              padding: '10px 20px', 
              cursor: 'pointer', 
              border: 'none', 
              borderRadius: '4px' 
            }}
          >
            Delete All Documents
          </button>
        )}
      </div>
      
      {/* File upload for client-side file upload */}
      <div className="file-upload">
        <label htmlFor="file-input">Select Files:</label>
        <input 
          type="file" 
          id="file-input" 
          multiple 
          accept=".pdf,.csv" 
          onChange={handleFileChange}
        />
        <button onClick={handleFileUploadClient} disabled={!selectedFiles.length}>
          Upload Files
        </button>
      </div>
      
      {/* Employee data import section */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '8px', border: '1px dashed #ccc' }}>
        <h2>Import Employee Attendance Data</h2>
        <p>Import the employee attendance data from utils-data/Employee present_absent status.txt</p>
        
        {employeeImportError && (
          <div style={{ color: 'red', margin: '1rem 0' }}>
            {employeeImportError}
          </div>
        )}
        
        {employeeImportSuccess && (
          <div style={{ color: 'green', margin: '1rem 0' }}>
            {employeeImportSuccess}
          </div>
        )}
        
        <button 
          onClick={handleEmployeeDataImport}
          disabled={employeeImportLoading}
          style={{ backgroundColor: '#4CAF50', color: 'white' }}
        >
          {employeeImportLoading ? 'Importing...' : 'Import Employee Data'}
        </button>
      </div>
      
      {/* CSV Import Button */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '8px', border: '1px dashed #ccc' }}>
        <h2>Import Employee CSV Data</h2>
        <p>Import the employee data from utils-data/Employee-present_absent-status.csv</p>
        
        {csvImportError && (
          <div style={{ color: 'red', margin: '1rem 0' }}>
            {csvImportError}
          </div>
        )}
        
        {csvImportSuccess && (
          <div style={{ color: 'green', margin: '1rem 0' }}>
            {csvImportSuccess}
          </div>
        )}
        
        <button 
          onClick={handleCSVDataImport}
          disabled={csvImportLoading}
          style={{color: 'white', padding: '10px 20px', cursor: 'pointer', border: 'none', borderRadius: '4px', marginRight: '10px' }}
        >
          {csvImportLoading ? 'Importing CSV...' : 'Import CSV Data'}
        </button>
      </div>
      
      {/* ChromaDB Test Section */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '8px', border: '1px solid #ccc' }}>
        <h2>Test ChromaDB Connection</h2>
        <p>Check if ChromaDB is properly connected and working with "nishant-collection"</p>
        
        {chromaStatus && (
          <div style={{ 
            margin: '1rem 0', 
            padding: '10px', 
            borderRadius: '4px',
            backgroundColor: chromaStatus.success ? '#e8f5e9' : '#ffebee',
            color: chromaStatus.success ? 'green' : 'red'
          }}>
            <h3>{chromaStatus.message}</h3>
            <p>{chromaStatus.details}</p>
          </div>
        )}
        
        <button 
          onClick={testChromaDB}
          disabled={chromaLoading}
          style={{ 
            color: 'white', 
            padding: '10px 20px', 
            cursor: 'pointer', 
            border: 'none', 
            borderRadius: '4px' 
          }}
        >
          {chromaLoading ? 'Testing...' : 'Test ChromaDB Connection'}
        </button>
      </div>
      
      {/* Import CSV to ChromaDB Button */}
      <div style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '8px', border: '1px solid #ccc' }}>
        <h2>Import CSV Data to ChromaDB</h2>
        <p>Import the employee data from utils-data/Employee-present_absent-status.csv directly to ChromaDB</p>
        
        {chromaImportError && (
          <div style={{ color: 'red', margin: '1rem 0' }}>
            {chromaImportError}
          </div>
        )}
        
        {chromaImportSuccess && (
          <div style={{ color: 'green', margin: '1rem 0' }}>
            {chromaImportSuccess}
          </div>
        )}
        
        <button 
          onClick={importCSVToChromaDB}
          disabled={chromaImportLoading}
          style={{ 
            backgroundColor: '#2196F3', 
            color: 'white', 
            padding: '10px 20px', 
            cursor: 'pointer', 
            border: 'none', 
            borderRadius: '4px' 
          }}
        >
          {chromaImportLoading ? 'Importing...' : 'Import CSV Data to ChromaDB'}
        </button>
      </div>
      
      {/* Document list */}
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