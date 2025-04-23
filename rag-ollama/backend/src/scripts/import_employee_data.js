import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOrCreateCollection } from '../utils/chromadb.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Collection name for employee data
const COLLECTION_NAME = 'employee_attendance';

// File path
const dataFilePath = path.join(__dirname, '../../utils-data/Employee present_absent status.txt');

/**
 * Process and chunk the employee attendance data
 * @param {string} filePath - Path to the data file
 * @returns {Array} - Array of chunked data with metadata
 */
async function processEmployeeData(filePath) {
  try {
    // Read the file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    console.log(`Read ${fileContent.length} characters from file`);
    
    // Split into chunks (approximate lines)
    const lines = fileContent.split('\n');
    console.log(`File contains ${lines.length} lines`);
    
    // Group lines into chunks of approximately 500 chars each for better retrieval
    const chunks = [];
    let currentChunk = '';
    let chunkId = 1;
    
    for (const line of lines) {
      if (line.trim().length === 0) continue; // Skip empty lines
      
      // If adding this line would make the chunk too large, start a new chunk
      if (currentChunk.length + line.length > 500 && currentChunk.length > 0) {
        chunks.push({
          id: `employee-chunk-${chunkId}`,
          content: currentChunk.trim(),
          metadata: {
            source: 'Employee present_absent status.txt',
            chunk: chunkId,
            type: 'attendance'
          }
        });
        chunkId++;
        currentChunk = '';
      }
      
      currentChunk += line + '\n';
    }
    
    // Add the last chunk if not empty
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `employee-chunk-${chunkId}`,
        content: currentChunk.trim(),
        metadata: {
          source: 'Employee present_absent status.txt',
          chunk: chunkId,
          type: 'attendance'
        }
      });
    }
    
    console.log(`Created ${chunks.length} chunks from employee data`);
    return chunks;
  } catch (error) {
    console.error('Error processing employee data:', error);
    throw error;
  }
}

/**
 * Import employee data into ChromaDB
 */
async function importEmployeeData() {
  try {
    console.log('Starting employee data import...');
    
    // Get the collection
    const collection = await getOrCreateCollection(COLLECTION_NAME);
    console.log(`Connected to collection: ${COLLECTION_NAME}`);
    
    // Process the data file
    const chunks = await processEmployeeData(dataFilePath);
    
    // Add chunks to the collection
    if (chunks.length > 0) {
      await collection.add({
        ids: chunks.map(chunk => chunk.id),
        documents: chunks.map(chunk => chunk.content),
        metadatas: chunks.map(chunk => chunk.metadata)
      });
      
      console.log(`Successfully added ${chunks.length} chunks to ChromaDB`);
    } else {
      console.log('No chunks to add to ChromaDB');
    }
    
    console.log('Employee data import completed successfully');
  } catch (error) {
    console.error('Error importing employee data:', error);
  }
}

// Run the import
console.log('Starting employee data import script...');
importEmployeeData()
  .then(() => console.log('Import script completed'))
  .catch(err => console.error('Import script failed:', err)); 