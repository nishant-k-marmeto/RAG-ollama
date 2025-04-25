import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Get Slack webhook URL from environment variables
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const MAX_MESSAGES_PER_WINDOW = process.env.SLACK_RATE_LIMIT || 30; // Default 30 messages per minute
let messagesSentInWindow = 0;
let windowStartTime = Date.now();

// Queue for batching messages during high traffic
const messageQueue = [];
let isProcessingQueue = false;

/**
 * Reset rate limiting window if needed
 */
function checkAndResetRateLimit() {
  const now = Date.now();
  if (now - windowStartTime > RATE_LIMIT_WINDOW) {
    // Reset window
    windowStartTime = now;
    messagesSentInWindow = 0;
    return true;
  }
  return false;
}

/**
 * Process the message queue asynchronously
 */
async function processMessageQueue() {
  if (isProcessingQueue || messageQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  try {
    console.log(`Processing Slack message queue (${messageQueue.length} messages)...`);
    
    // Process messages until the queue is empty or rate limit is hit
    while (messageQueue.length > 0) {
      // Check rate limits
      checkAndResetRateLimit();
      
      if (messagesSentInWindow >= MAX_MESSAGES_PER_WINDOW) {
        console.log(`Slack rate limit reached (${MAX_MESSAGES_PER_WINDOW} messages per ${RATE_LIMIT_WINDOW/1000}s). Pausing queue processing.`);
        
        // Schedule next queue processing after window reset
        const timeToNextWindow = (windowStartTime + RATE_LIMIT_WINDOW) - Date.now();
        setTimeout(processMessageQueue, timeToNextWindow + 100);
        break;
      }
      
      // Get the next message
      const nextMessage = messageQueue.shift();
      
      // Send to Slack
      try {
        await axios.post(SLACK_WEBHOOK_URL, nextMessage);
        messagesSentInWindow++;
      } catch (error) {
        console.error('Error sending message to Slack:', error.message);
      }
      
      // Small delay between messages to avoid overwhelming Slack
      if (messageQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  } finally {
    isProcessingQueue = false;
    
    // If there are still messages in the queue, schedule processing
    if (messageQueue.length > 0) {
      setTimeout(processMessageQueue, 1000);
    }
  }
}

/**
 * Log message to Slack channel with rate limiting
 * @param {Object} message - The message object to send to Slack
 * @returns {Promise} - Response from Slack API
 */
export async function logToSlack(message) {
  try {
    if (!SLACK_WEBHOOK_URL) {
      console.warn('Slack logging disabled - SLACK_WEBHOOK_URL not set in environment variables');
      return;
    }
    
    // Add timestamp if not present
    if (message.attachments && message.attachments.length > 0 && !message.attachments[0].ts) {
      message.attachments[0].ts = Math.floor(Date.now() / 1000);
    }
    
    // Check rate limits
    checkAndResetRateLimit();
    
    // If under rate limit and queue is empty, send immediately
    if (messagesSentInWindow < MAX_MESSAGES_PER_WINDOW && messageQueue.length === 0) {
      messagesSentInWindow++;
      return await axios.post(SLACK_WEBHOOK_URL, message);
    } 
    // Otherwise queue the message
    else {
      // Add to queue
      messageQueue.push(message);
      console.log(`Queued Slack message. Queue size: ${messageQueue.length}`);
      
      // Start queue processing if not already running
      if (!isProcessingQueue) {
        processMessageQueue();
      }
      
      return { queued: true, queueSize: messageQueue.length };
    }
  } catch (error) {
    console.error('Error logging to Slack:', error.message);
    // Don't throw as logging shouldn't break application flow
  }
}

/**
 * Format request information for logging
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - Formatted message for Slack
 */
export function formatRequestForSlack(req, res) {
  // Get basic request information
  const method = req.method;
  const path = req.originalUrl;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const statusCode = res.statusCode;
  const timestamp = new Date().toISOString();
  
  // Determine color based on status code
  let color = '#2eb886'; // Green for success
  if (statusCode >= 400 && statusCode < 500) {
    color = '#f2c744'; // Yellow for client errors
  } else if (statusCode >= 500) {
    color = '#cc0000'; // Red for server errors
  }
  
  // Create Slack message with attachments
  return {
    text: `New API Request: ${method} ${path}`,
    attachments: [
      {
        color: color,
        fields: [
          {
            title: 'Request Details',
            value: `Method: ${method}\nPath: ${path}\nStatus: ${statusCode}\nIP: ${ip}\nUser-Agent: ${userAgent}\nTimestamp: ${timestamp}`,
            short: false
          },
          {
            title: 'Request Body',
            value: `\`\`\`${JSON.stringify(sanitizeRequestBody(req.body), null, 2)}\`\`\``,
            short: false
          }
        ],
        footer: "RAG Ollama API",
        ts: Math.floor(Date.now() / 1000)
      }
    ]
  };
}

/**
 * Sanitize request body for logging (remove sensitive data)
 * @param {Object} body - Request body
 * @returns {Object} - Sanitized body
 */
function sanitizeRequestBody(body) {
  if (!body) return {};
  
  // Create a copy to avoid modifying the original
  const sanitized = { ...body };
  
  // List of sensitive fields to mask
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey', 'api_key'];
  
  // Recursively sanitize nested objects
  function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    Object.keys(obj).forEach(key => {
      // If this is a sensitive field, mask it
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        obj[key] = '******';
      } 
      // If this is a nested object, recursively sanitize
      else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    });
    
    return obj;
  }
  
  return sanitizeObject(sanitized);
}

/**
 * Format error information for logging
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @returns {Object} - Formatted error message for Slack
 */
export function formatErrorForSlack(error, req) {
  const timestamp = new Date().toISOString();
  const method = req?.method || 'unknown';
  const path = req?.originalUrl || 'unknown';
  
  return {
    text: `❌ API Error: ${error.message}`,
    attachments: [
      {
        color: '#cc0000', // Red for errors
        fields: [
          {
            title: 'Error Details',
            value: `Message: ${error.message}\nRequest: ${method} ${path}\nTimestamp: ${timestamp}`,
            short: false
          },
          {
            title: 'Stack Trace',
            value: `\`\`\`${error.stack || 'No stack trace available'}\`\`\``,
            short: false
          }
        ],
        footer: "RAG Ollama API Error",
        ts: Math.floor(Date.now() / 1000)
      }
    ]
  };
} 