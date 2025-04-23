import axios from 'axios';

/**
 * Simple script to check if ChromaDB is up and running
 */

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';

async function checkChromaDBHealth() {
  try {
    console.log(`Checking ChromaDB health at ${CHROMA_URL}...`);
    const response = await axios.get(`${CHROMA_URL}/api/v2/heartbeat`);
    
    if (response.status === 200) {
      console.log('✅ ChromaDB is up and running!');
      return true;
    } else {
      console.error(`❌ ChromaDB returned unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ ChromaDB server is not available:', error.message);
    return false;
  }
}

// Run the check
checkChromaDBHealth().then(isRunning => {
  if (!isRunning) {
    console.log('\nTo start ChromaDB, run: npm run start:chroma');
    console.log('To start both ChromaDB and backend, run: npm run dev:all');
  }
}); 