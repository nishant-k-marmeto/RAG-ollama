import dotenv from 'dotenv';
import { queryDocuments, addDocument } from '../services/documentService.js';

// Load environment variables
dotenv.config();

/**
 * Test script to demonstrate document search capabilities
 */
async function testSearch() {
  try {
    console.log('Starting search test...');
    
    // Check if we should add test documents
    const addTestDocs = process.argv.includes('--add-docs');
    
    if (addTestDocs) {
      console.log('Adding sample documents for testing...');
      
      // Add some test documents
      const testDocs = [
        {
          title: 'JavaScript Basics',
          content: 'JavaScript is a programming language used to create interactive effects within web browsers. It is an essential web technology, along with HTML and CSS.',
        },
        {
          title: 'React Components',
          content: 'React components are reusable pieces of code that return HTML elements via JSX. They can be either function components or class components.',
        },
        {
          title: 'Node.js Introduction',
          content: 'Node.js is a JavaScript runtime built on Chrome\'s V8 JavaScript engine. It allows developers to run JavaScript on the server-side.',
        },
        {
          title: 'Python vs JavaScript',
          content: 'Python and JavaScript are both popular programming languages. Python is often used for data science and backend development, while JavaScript is primarily used for web development.',
        }
      ];
      
      for (const doc of testDocs) {
        await addDocument(doc.title, doc.content);
      }
      
      console.log('Sample documents added successfully!');
    }
    
    // Run test queries
    const queries = [
      'What is JavaScript?',
      'Tell me about React components',
      'server-side JavaScript',
      'programming languages comparison'
    ];
    
    console.log('\nRunning test queries...');
    
    for (const query of queries) {
      console.log(`\n===== QUERY: "${query}" =====`);
      
      const results = await queryDocuments(query, {
        limit: 2,
        includeDistances: true
      });
      
      console.log(`Found ${results.count} results in ${results.metrics.queryTimeMs}ms`);
      
      if (results.count > 0) {
        results.results.forEach((result, index) => {
          console.log(`\nResult #${index + 1} (Similarity: ${(result.similarity * 100).toFixed(1)}%):`);
          console.log(`ID: ${result.id}`);
          console.log(`Source: ${result.metadata?.source || 'Unknown'}`);
          console.log(`Content: ${result.content.substring(0, 100)}${result.content.length > 100 ? '...' : ''}`);
        });
      } else {
        console.log('No matching documents found.');
      }
    }
    
    console.log('\nSearch test completed!');
    console.log('\nTo add test documents next time, run: node src/scripts/test-search.js --add-docs');
  } catch (error) {
    console.error('Error in search test:', error);
  }
}

// Run the test function
testSearch(); 