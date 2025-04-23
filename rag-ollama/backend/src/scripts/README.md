# Scripts Documentation

This directory contains various utility scripts for managing the ChromaDB vector database and document operations. These scripts can be used independently of the main application for maintenance, testing, and data management tasks.

## Available Scripts

### 1. `add-to-chroma.js`
**Purpose**: Adds a document manually to a ChromaDB collection.
**Functionality**:
- Connects to the ChromaDB service
- Creates or gets an existing collection
- Adds a document with specified content, metadata, and ID
- Useful for testing or adding specific documents to the knowledge base

### 2. `check-chroma.js`
**Purpose**: Tests connection to ChromaDB and checks the status of a collection.
**Functionality**:
- Establishes a connection to the ChromaDB service
- Retrieves information about the specified collection
- Reports the number of documents in the collection
- Helps verify that ChromaDB is properly set up and accessible

### 3. `delete-all-from-chroma.js`
**Purpose**: Removes all documents from a specified ChromaDB collection.
**Functionality**:
- Connects to the ChromaDB service
- Gets all document IDs from the specified collection
- Deletes all documents in a single operation
- Useful for clearing the knowledge base completely

### 4. `import-csv-to-chroma.js`
**Purpose**: Imports CSV file data directly into ChromaDB.
**Functionality**:
- Reads a CSV file (primarily targeting the Employee attendance data)
- Parses the CSV content into structured data
- Creates embeddings and adds the data to ChromaDB
- Preserves the structure of the CSV while making it searchable

### 5. `import_csv_to_docs.js`
**Purpose**: Converts CSV files into text documents that can be added to the knowledge base.
**Functionality**:
- Reads CSV files from a specified directory
- Transforms CSV data into a text format
- Creates documents that can be added to the knowledge base
- Useful for preprocessing data before adding to ChromaDB

### 6. `import_employee_data.js`
**Purpose**: Specifically imports employee attendance data from the text file.
**Functionality**:
- Reads the "Employee present_absent status.txt" file
- Parses and structures the employee attendance information
- Chunks the data appropriately for vector storage
- Adds the formatted data to the ChromaDB collection

### 7. `query-chroma.js`
**Purpose**: Tests querying capabilities of ChromaDB.
**Functionality**:
- Connects to ChromaDB
- Accepts a query string as input
- Performs similarity search against the vector database
- Returns and displays relevant document matches
- Useful for testing search functionality and relevance

## How to Use

To run any script, navigate to the scripts directory and use Node.js to execute it:

```bash
cd backend/src/scripts
node <script-name>.js
```

For scripts that require arguments, you can pass them after the script name:

```bash
node query-chroma.js "your search query here"
```

## Environment Requirements

All scripts require:
- Node.js environment
- ChromaDB running on the configured URL (default: http://localhost:8000)
- Appropriate environment variables set (same as main application) 