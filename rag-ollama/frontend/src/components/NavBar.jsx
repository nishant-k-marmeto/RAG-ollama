import React from 'react';
import { Link } from 'react-router-dom';

const NavBar = () => {
  return (
    <nav style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      padding: '1rem', 
      backgroundColor: '#333', 
      color: 'white',
      marginBottom: '2rem',
      borderRadius: '8px'
    }}>
      <div className="logo">
        <h2>RAG Ollama</h2>
      </div>
      <div className="nav-links" style={{ display: 'flex', gap: '1rem' }}>
        <Link to="/" style={{ color: 'white' }}>Chat</Link>
        <Link to="/documents" style={{ color: 'white' }}>Documents</Link>
      </div>
    </nav>
  );
};

export default NavBar; 