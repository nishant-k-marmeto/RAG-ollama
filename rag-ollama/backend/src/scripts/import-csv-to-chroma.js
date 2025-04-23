import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import { getOrCreateCollection } from '../utils/chromadb.js';

/**
 * Script to import CSV data into ChromaDB
 */

async function importCSVToChroma() {
  try {
    // Get file path
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const csvFilePath = path.join(__dirname, '../../../utils-data/Employee-present_absent-status.csv');
    
    // Check if file exists
    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV file not found: ${csvFilePath}`);
      return;
    }
    
    console.log(`Reading CSV file: ${csvFilePath}`);
    
    // Read the CSV file
    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve())
        .on('error', reject);
    });
    
    console.log(`Read ${rows.length} rows from CSV file`);
    
    // Convert to string representation
    const content = rows.map(row => {
      return Object.entries(row)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }).join('\n');
    
    console.log('Getting collection...');
    const collection = await getOrCreateCollection('nishant-collection');
    
    // Generate a unique ID for this document
    const documentId = `employee-csv-${Date.now()}`;
    
    console.log('Adding CSV data to ChromaDB...');
    await collection.add({
      ids: [documentId],
      documents: [content],
      metadatas: [{ 
        source: 'Employee-present_absent-status.csv',
        type: 'csv',
        created: new Date().toISOString(),
        rows: rows.length
      }],
    });
    
    console.log('✅ CSV data successfully added to ChromaDB!');
    console.log(`Document ID: ${documentId}`);
    
    // Verify by querying for employee-related terms
    console.log('\nVerifying import by querying for employee-related terms...');
    
    const results = await collection.query({
      nResults: 1,
      queryTexts: ["employee attendance"]
    });
    
    if (results.ids[0]?.length > 0) {
      console.log('✅ Document found in query results!');
      console.log(`- ID: ${results.ids[0][0]}`);
      console.log(`- Content snippet: ${results.documents[0][0].substring(0, 100)}...`);
    } else {
      console.log('❌ Document not found in query results.');
    }
    
  } catch (error) {
    console.error('Error importing CSV to ChromaDB:', error);
    console.error('Make sure ChromaDB server is running with: npm run start:chroma');
  }
}

// Run the function
importCSVToChroma(); 