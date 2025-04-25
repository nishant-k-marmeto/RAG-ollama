import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import sentenceSplitter from 'sentence-splitter';  // Correct import for sentence-splitter

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

      if (fileExt === '.txt') {
        await processAndAddText(filePath, collection);
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
 * Process and add text content to ChromaDB
 * @param {string} filePath - Path to text file
 * @param {object} collection - ChromaDB collection
 */
async function processAndAddText(filePath, collection) {
  try {
    // Read text file
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    
    // Split content into semantically meaningful chunks
    const chunks = chunkTextBySentences(content);
    console.log(`Split ${fileName} into ${chunks.length} chunks based on sentences`);
    
    if (chunks.length > 0) {
      // Generate unique IDs for each chunk
      const ids = chunks.map((_, index) => 
        `txt-${fileName}-${Date.now()}-${index}`
      );
      
      // Prepare metadata for each chunk
      const metadatas = chunks.map((_, index) => ({
        source: fileName,
        type: 'text',
        chunk: index + 1,
        totalChunks: chunks.length
      }));
      
      // Add all chunks to collection
      await collection.add({
        ids,
        documents: chunks,
        metadatas
      });
      
      console.log(`Added ${chunks.length} chunks from text file: ${fileName}`);
    } else {
      // If no chunks were created, add the entire content as one document
      await collection.add({
        ids: [`txt-${fileName}-${Date.now()}`],
        documents: [content],
        metadatas: [{ source: fileName, type: 'text' }],
      });
      
      console.log(`Added text file: ${fileName} as a single document`);
    }
  } catch (error) {
    console.error(`Error processing text file ${filePath}:`, error);
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
      ids: [`csv-${path.basename(filePath)}-${Date.now()}`],
      documents: [csvContent],
      metadatas: [{ source: path.basename(filePath), type: 'csv' }],
    });
    
    console.log(`Added CSV: ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`Error processing CSV ${filePath}:`, error);
    throw error;
  }
}

/**
 * Chunk text into smaller pieces based on sentences
 * @param {string} text - The text to chunk
 * @param {number} maxChunkSize - Maximum size of each chunk (approximate target)
 * @returns {string[]} Array of text chunks divided by sentences
 */
export function chunkTextBySentences(text, maxChunkSize = 1000) {
  try {
    // Split text into sentences using sentence-splitter
    const sentenceNodes = sentenceSplitter(text);
    
    // Extract raw sentences directly and avoid unnecessary array creation
    const sentences = sentenceNodes.filter(node => node.type === 'Sentence').map(node => node.raw);
    
    const chunks = [];
    let currentChunk = '';
    
    sentences.forEach((sentence) => {
      // If adding this sentence would exceed the chunk size and we already have content, start a new chunk
      if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // Add the sentence to the current chunk
      currentChunk += sentence + ' ';
    });
    
    // Push the last chunk if any content exists
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    console.log(`Split text into ${chunks.length} semantically meaningful chunks`);
    return chunks;
  } catch (error) {
    console.error('Error chunking text by sentences:', error);
    return chunkText(text, maxChunkSize); // Fallback to character-based chunking if sentence-splitter fails
  }
}

/**
 * Legacy character-based text chunking (fallback method)
 * @param {string} text - The text to chunk
 * @param {number} size - Chunk size
 * @param {number} overlap - Overlap between chunks
 * @returns {string[]} Array of text chunks
 */
export function chunkText(text, size = 1000, overlap = 200) {
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