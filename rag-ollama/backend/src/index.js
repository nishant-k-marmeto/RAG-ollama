import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import axios from 'axios';

// Import routes
import ragRoutes from './routes/ragRoutes.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// Directory for documents
const docsDir = path.join(__dirname, '..', 'docs');
console.log(`Documents directory: ${docsDir}`);

// Check if ChromaDB is running
async function checkChromaDBHealth() {
  const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
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
    console.log('You can start ChromaDB with: npm run start:chroma');
    console.log('The app will continue to run with in-memory document storage only.');
    return false;
  }
}

// Routes
app.use('/api/rag', ragRoutes);

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  // Check ChromaDB status when the server starts
  await checkChromaDBHealth();
});

export default app; 