import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';

/**
 * Adds files from a directory to a ChromaDB collection
 * @param {string} dirPath - Path to directory containing files
 * @param {object} collection - ChromaDB collection to add documents to
 */
export async function addFilesToCollection(dirPath, collection) {
  try {
    // Get all files in the directory
    const files = fs.readdirSync(dirPath);
    let documentCount = 0;

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const fileExt = path.extname(file).toLowerCase();
      
      // Skip directories and hidden files
      if (fs.statSync(filePath).isDirectory() || file.startsWith('.')) {
        continue;
      }

      if (fileExt === '.pdf') {
        await processAndAddPdf(filePath, collection);
        documentCount++;
      } else if (fileExt === '.csv') {
        await processAndAddCsv(filePath, collection);
        documentCount++;
      } else {
        console.log(`Skipping unsupported file: ${file}`);
      }
    }

    console.log(`Added content from ${documentCount} files to ChromaDB`);
    return documentCount;
  } catch (error) {
    console.error('Error adding files to collection:', error);
    throw error;
  }
}

/**
 * Process and add PDF content to ChromaDB
 * @param {string} filePath - Path to PDF file
 * @param {object} collection - ChromaDB collection
 */
async function processAndAddPdf(filePath, collection) {
  try {
    // We'll use a PDF parser library here
    // This is a placeholder for the actual PDF parsing
    const pdfContent = `Content from PDF: ${path.basename(filePath)}`;
    
    // Add to collection
    await collection.add({
      ids: [`pdf-${Date.now()}-${Math.floor(Math.random() * 1000)}`],
      documents: [pdfContent],
      metadatas: [{ source: filePath, type: 'pdf' }],
    });
    
    console.log(`Added PDF: ${filePath}`);
  } catch (error) {
    console.error(`Error processing PDF ${filePath}:`, error);
    throw error;
  }
}

/**
 * Process and add CSV content to ChromaDB
 * @param {string} filePath - Path to CSV file
 * @param {object} collection - ChromaDB collection
 */
async function processAndAddCsv(filePath, collection) {
  try {
    const rows = [];
    
    // Read CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });
    
    // Convert each row to string
    const csvContent = rows.map(row => JSON.stringify(row)).join('\n');
    
    // Add to collection
    await collection.add({
      ids: [`csv-${Date.now()}-${Math.floor(Math.random() * 1000)}`],
      documents: [csvContent],
      metadatas: [{ source: filePath, type: 'csv' }],
    });
    
    console.log(`Added CSV: ${filePath}`);
  } catch (error) {
    console.error(`Error processing CSV ${filePath}:`, error);
    throw error;
  }
}

/**
 * Chunk text into smaller pieces
 * @param {string} text - The text to chunk
 * @param {number} size - Chunk size
 * @param {number} overlap - Overlap between chunks
 * @returns {string[]} Array of text chunks
 */
export function chunkText(text, size = 500, overlap = 100) {
  const chunks = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + size, text.length);
    chunks.push(text.substring(startIndex, endIndex));
    startIndex = endIndex - overlap;
    
    // If we're near the end, just include the last chunk and break
    if (startIndex + size >= text.length) {
      if (endIndex < text.length) {
        chunks.push(text.substring(startIndex));
      }
      break;
    }
  }
  
  return chunks;
} 