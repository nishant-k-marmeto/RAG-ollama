import dotenv from 'dotenv';
import { chatWithContext } from '../services/chatService.js';

// Load environment variables
dotenv.config();

/**
 * Test script to verify that chat retrieves document context
 */
async function testChatWithContext() {
  try {
    console.log('===== TESTING CHAT WITH CONTEXT =====');
    
    // Create a unique conversation ID for this test
    const conversationId = `test-${Date.now()}`;
    console.log(`Using conversation ID: ${conversationId}`);
    
    // Test query that should match our test document
    const queries = [
      'Tell me about fruits in the document',
      'What policies are available in the system?',
      'Tell me about travel policies'
    ];
    
    // Run each test query
    for (const query of queries) {
      console.log(`\n\nTesting query: "${query}"`);
      console.log('Sending to chatWithContext...');
      
      const response = await chatWithContext(conversationId, query, false);
      
      console.log('\nChat response:');
      console.log(`Answer: ${response.answer.substring(0, 200)}${response.answer.length > 200 ? '...' : ''}`);
      
      if (response.documents && response.documents.length > 0) {
        console.log(`\nRetrieved ${response.documents.length} documents for context:`);
        response.documents.forEach((doc, i) => {
          console.log(`\nDocument ${i+1}:`);
          console.log(`- Title: ${doc.title}`);
          console.log(`- Content: ${doc.content.substring(0, 50)}...`);
        });
        console.log('\n✅ Test passed - documents were retrieved for context');
      } else {
        console.log('\n❌ No documents retrieved for context');
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing chat with context:', error);
    console.error(error.stack);
  }
}

// Run the test
testChatWithContext().then(() => {
  console.log('Test script completed');
  process.exit(0);
}).catch(err => {
  console.error('Test script failed:', err);
  process.exit(1);
}); 