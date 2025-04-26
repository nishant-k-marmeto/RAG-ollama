// optimizedChatController.js

import { Ollama } from 'ollama';
import { getOrCreateCollection, queryCollection } from '../utils/chromadb.js';

const COLLECTION_NAME = 'rag_documents';
let ollamaClient = null;
const cache = new Map(); // Simple in-memory cache for Chroma queries

function getOllamaClient() {
  if (!ollamaClient) {
    console.log('Creating Ollama client...');
    ollamaClient = new Ollama({
      host: process.env.OLLAMA_HOST || 'http://localhost:11434',
      keepAlive: true,
      keepAliveMsecs: 300000,
      headers: { 'Connection': 'keep-alive' },
      options: { num_gpu: 1, numa: true }
    });
  }
  return ollamaClient;
}

async function ensureOllamaConnection() {
  try {
    await getOllamaClient().list();
    return true;
  } catch (error) {
    console.error('Ollama connection failed, retrying...', error.message);
    ollamaClient = null;
    getOllamaClient();
    return false;
  }
}

async function cachedQuery(collection, queryText, nResults = 2) {
  if (cache.has(queryText)) {
    console.log('Cache hit for query:', queryText);
    return cache.get(queryText);
  }
  const result = await queryCollection(collection, nResults, [queryText]);
  cache.set(queryText, result);
  if (cache.size > 100) cache.delete(cache.keys().next().value); // Evict oldest
  return result;
}

export async function chatWithContext(conversationId, userMessage, useChainOfThought = false) {
  try {
    console.log(`\n=== Starting chat session for ID: ${conversationId} ===`);

    await ensureOllamaConnection();

    const start = Date.now();

    const collectionPromise = getOrCreateCollection(COLLECTION_NAME);
    const connectionCheck = ensureOllamaConnection();

    await Promise.all([collectionPromise, connectionCheck]);

    const collection = await collectionPromise;
    const ragResult = await cachedQuery(collection, userMessage, 2);

    const context = ragResult?.documents?.[0]?.join('\n\n') || '';

    let systemPrompt = `You are a helpful assistant with access to a knowledge base.\n- Always cite if using information from documents.\n- Format answers neatly in bullet points.`;
    if (useChainOfThought) {
      systemPrompt += `\nIMPORTANT: Think step-by-step. Prefix with 'Thinking:' before final answer.`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(context ? [{ role: 'system', content: `Context:\n${context}` }] : []),
      { role: 'user', content: userMessage }
    ];

    console.log(`Prepared ${messages.length} messages.`);

    const response = await getOllamaClient().chat({
      model: 'llama3.2:1b',
      messages,
      options: {
        top_p: 0.9,
        num_ctx: 2048, // reduced for faster processing
        temperature: 0.7
      }
    });

    const duration = Date.now() - start;
    console.log(`Chat session completed in ${duration} ms.`);

    return {
      answer: response.message.content,
      documents: ragResult?.documents?.[0] || []
    };
  } catch (error) {
    console.error('Chat session error:', error);
    throw new Error('Failed to complete chat session: ' + error.message);
  }
}

export async function streamChat(conversation, onToken) {
  try {
    await ensureOllamaConnection();

    const messages = conversation.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    const response = await getOllamaClient().chat({
      model: 'llama3.2:1b',
      messages,
      stream: true,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_ctx: 2048,
      },
      onComplete: (message) => onToken({ done: true }),
      onStream: ({ message }) => onToken({ token: message.content, done: false })
    });

    return {
      message: {
        role: 'assistant',
        content: response
      },
      metrics: {
        streamed: true
      }
    };
  } catch (error) {
    console.error('Stream chat error:', error);
    throw new Error('Failed to complete streaming chat: ' + error.message);
  }
}
