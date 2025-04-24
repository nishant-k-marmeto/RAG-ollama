import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import axios from 'axios';

// Get the current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the CSV file
const csvFilePath = path.join(__dirname, '../../utils-data/Employee-present_absent-status.csv');
const API_URL = 'https://ai-tool.marmeto.com/api/rag/add-document';

async function importCSVToDocuments() {
  try {
    // Ensure the file exists
    if (!fs.existsSync(csvFilePath)) {
      console.error(`File not found: ${csvFilePath}`);
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
    
    // Convert to string representation
    const content = rows.map(row => {
      return Object.entries(row)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }).join('\n');
    
    // Add the document via the API
    const response = await axios.post(API_URL, {
      title: 'Employee Attendance Data',
      content: content
    });
    
    console.log('Document added successfully:', response.data);
  } catch (error) {
    console.error('Error importing CSV to documents:', error.message);
  }
}

// Run the import function
importCSVToDocuments().then(() => {
  console.log('Import completed');
}).catch(err => {
  console.error('Import failed:', err);
}); 