# Slack Logging for RAG Ollama API

This document describes how to set up and customize Slack logging for the RAG Ollama API.

## Overview

The Slack logging system sends detailed logs of API requests and errors to a specified Slack channel, providing real-time monitoring of your application's activity and issues.

## Setup Instructions

### 1. Create a Slack App and Webhook

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and click "Create New App" > "From scratch"
2. Name your app (e.g., "RAG Ollama Logger") and select your workspace
3. In the sidebar, click on "Incoming Webhooks" and toggle "Activate Incoming Webhooks" to On
4. Click "Add New Webhook to Workspace" and select the channel where you want to receive logs
5. Copy the Webhook URL that Slack provides

### 2. Configure Environment Variables

Add the Slack webhook URL to your `.env` file:

```
# Slack logging configuration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_SLACK_WEBHOOK_URL

# Optional: Rate limit (messages per minute)
SLACK_RATE_LIMIT=30

# Optional: Paths to exclude from logging (comma-separated)
DISABLE_SLACK_LOGGING_FOR=/health,/api/rag/heartbeat
```

### 3. Restart Your Server

```bash
npm run dev
```

## Features

### Request Logging

For each request, the following information is logged to Slack:
- HTTP method and path
- Status code
- IP address
- User agent
- Request body (with sensitive data redacted)
- Response time

### Error Logging

When errors occur, the following information is logged:
- Error message
- Request details
- Stack trace
- Timestamp

### Performance Optimizations

To prevent overwhelming Slack and your application:

1. **Rate Limiting**: Limits the number of messages sent within a time window (default: 30 messages per minute)
2. **Message Queuing**: During high traffic, messages are queued and sent gradually
3. **Path Exclusions**: Frequently accessed endpoints like health checks can be excluded from logging

## Customization Options

### Excluding Endpoints

To exclude certain endpoints from logging, set the `DISABLE_SLACK_LOGGING_FOR` environment variable:

```
DISABLE_SLACK_LOGGING_FOR=/health,/api/rag/heartbeat,/api/rag/documents
```

By default, the following endpoints are excluded:
- `/health`
- `/api/rag/heartbeat`

### Rate Limiting

Adjust the rate limit by setting the `SLACK_RATE_LIMIT` environment variable:

```
SLACK_RATE_LIMIT=60  # 60 messages per minute
```

### Message Formatting

To customize message formatting, modify the formatter functions in `backend/src/utils/slackLogger.js`:

- `formatRequestForSlack`: Formats request logs
- `formatErrorForSlack`: Formats error logs

### Sensitive Data Handling

Add additional sensitive fields to redact in the `sanitizeRequestBody` function in `slackLogger.js`:

```js
const sensitiveFields = [
  'password', 
  'token', 
  'secret', 
  'key', 
  'apiKey', 
  'api_key',
  // Add your custom fields:
  'credit_card',
  'ssn'
];
```

## Troubleshooting

### Messages Not Appearing in Slack

1. Check that `SLACK_WEBHOOK_URL` is correctly set in your `.env` file
2. Verify the Slack app has permission to post to the channel
3. Look for error messages in your server logs related to Slack

### Too Many Messages

If Slack is being overwhelmed with messages:

1. Increase the rate limit: `SLACK_RATE_LIMIT=60`
2. Add more paths to exclude: `DISABLE_SLACK_LOGGING_FOR=/health,/frequent/endpoint`
3. Consider logging only errors in production: modify the middleware to check `process.env.NODE_ENV`

## Advanced Usage

### Selective Logging Based on Status Code

To modify the middleware to only log errors or specific status codes, edit `slackLoggerMiddleware.js`:

```js
// In the res.end function override:
if (res.statusCode >= 400) { // Only log errors
  const slackMessage = formatRequestForSlack(req, res);
  logToSlack(slackMessage);
}
```

### Custom Log Categories

To categorize logs, modify the `formatRequestForSlack` function:

```js
// Add a category field based on the path
let category = 'General';
if (path.includes('/rag/query')) {
  category = 'Query';
} else if (path.includes('/rag/chat')) {
  category = 'Chat';
}

return {
  text: `[${category}] New API Request: ${method} ${path}`,
  // ...rest of the message
};
``` 