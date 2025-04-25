import { logToSlack, formatRequestForSlack, formatErrorForSlack } from '../utils/slackLogger.js';

// Get paths to ignore from environment variable
const pathsToIgnore = process.env.DISABLE_SLACK_LOGGING_FOR ? 
  process.env.DISABLE_SLACK_LOGGING_FOR.split(',') : 
  ['/health', '/api/rag/heartbeat']; // Default paths to ignore

/**
 * Check if a request path should be ignored for logging
 * @param {string} path - Request path
 * @returns {boolean} - True if path should be ignored
 */
function shouldIgnorePath(path) {
  return pathsToIgnore.some(ignorePath => path.startsWith(ignorePath));
}

/**
 * Middleware to log all requests to Slack
 */
export function slackLoggerMiddleware(req, res, next) {
  // Skip logging for ignored paths
  if (shouldIgnorePath(req.originalUrl)) {
    return next();
  }
  
  // Store original end function
  const originalEnd = res.end;
  
  // Track response time
  const startTime = Date.now();
  
  // Override end function to log after response is sent
  res.end = function(chunk, encoding) {
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Call original end function
    originalEnd.call(this, chunk, encoding);
    
    // Log to Slack asynchronously (don't wait for it)
    const slackMessage = formatRequestForSlack(req, res);
    
    // Add response time to the message
    if (slackMessage.attachments && slackMessage.attachments.length > 0) {
      const details = slackMessage.attachments[0].fields.find(f => f.title === 'Request Details');
      if (details) {
        details.value += `\nResponse Time: ${responseTime}ms`;
      }
    }
    
    // Don't block the request-response cycle
    logToSlack(slackMessage).catch(err => {
      console.error('Failed to log to Slack:', err.message);
    });
  };
  
  // Continue to next middleware
  next();
}

/**
 * Middleware to log all errors to Slack
 */
export function slackErrorLoggerMiddleware(err, req, res, next) {
  // Skip logging for ignored paths
  if (req && shouldIgnorePath(req.originalUrl)) {
    return next(err);
  }
  
  // Log error to Slack asynchronously
  const slackMessage = formatErrorForSlack(err, req);
  
  // Don't block the error handling
  logToSlack(slackMessage).catch(logErr => {
    console.error('Failed to log error to Slack:', logErr.message);
  });
  
  // Continue to next error handler
  next(err);
} 