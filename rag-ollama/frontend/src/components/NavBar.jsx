import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NavBar = () => {
  const location = useLocation();
  
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">RAG System</Link>
      </div>
      <ul className="navbar-nav">
        <li className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
          <Link to="/">Home</Link>
        </li>
        <li className={`nav-item ${location.pathname === '/documents' ? 'active' : ''}`}>
          <Link to="/documents">Documents</Link>
        </li>
        <li className={`nav-item ${location.pathname === '/chat' ? 'active' : ''}`}>
          <Link to="/chat">Chat</Link>
        </li>
      </ul>
    </nav>
  );
};

export default NavBar; 