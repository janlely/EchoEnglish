# Logger Utility Documentation

## Overview

The logger utility provides a centralized logging system with configurable log levels for the EchoEnglish app.

## Features

- **Log Levels**: Support for `debug`, `info`, `warn`, and `error` levels
- **Configurable**: Set minimum log level globally
- **Timestamped**: Each log includes a timestamp
- **Tagged**: Logs include a tag for easy filtering
- **Consistent**: Unified logging format across the app

## Usage

### Import

```typescript
import logger from './src/utils/logger';
```

### Log Levels

```typescript
// Debug: Detailed debugging information (lowest priority)
logger.debug('Tag', 'Debug message', additionalData);

// Info: General operational information
logger.info('Tag', 'Info message', additionalData);

// Warn: Warning messages for potential issues
logger.warn('Tag', 'Warning message', additionalData);

// Error: Error messages for exceptions and failures
logger.error('Tag', 'Error message', error);
```

### Setting Log Level

Set the log level in `App.tsx` (or any initialization point):

```typescript
import logger from './src/utils/logger';

// Show all logs (default)
logger.setLevel('debug');

// Show only info, warn, and error (recommended for production)
logger.setLevel('info');

// Show only warn and error
logger.setLevel('warn');

// Show only errors
logger.setLevel('error');
```

### Log Output Format

Logs are formatted as:
```
[HH:MM:SS.mmm] [LEVEL] [Tag] message...
```

Example output:
```
[12:17:26.608] [DEBUG] [ChatDetailScreen] Fetching messages for conversationId: abc123
[12:17:26.610] [INFO] [ChatDetailScreen] Received message from WebSocket: {...}
[12:17:26.612] [ERROR] [TranslationAssistantModal] Stream error: Network error
```

## Migration Guide

### Before (console.log)

```typescript
console.log('[ChatDetailScreen] Fetching messages:', conversationId);
console.error('[ChatDetailScreen] Error:', error);
```

### After (logger)

```typescript
logger.debug('ChatDetailScreen', 'Fetching messages:', conversationId);
logger.error('ChatDetailScreen', 'Error:', error);
```

## Log Level Guidelines

### DEBUG Level
- Detailed internal state information
- Variable values and flow tracing
- Function entry/exit points
- Database query results

### INFO Level
- User actions (login, logout, send message)
- System state changes
- WebSocket connection events
- Important operational milestones

### WARN Level
- Recoverable errors
- Fallback scenarios
- Performance warnings
- Deprecated feature usage

### ERROR Level
- Unhandled exceptions
- Network failures
- Database errors
- Critical system failures

## Current Implementation

The logger has been integrated into:
- `App.tsx` - App initialization and user sync
- `ChatDetailScreen.tsx` - Chat message handling
- `TranslationAssistantModal.tsx` - Translation assistant

## Configuration

To change the log level for different environments:

```typescript
// Development
logger.setLevel('debug');

// Production
if (__DEV__) {
  logger.setLevel('debug');
} else {
  logger.setLevel('info'); // or 'warn'
}
```

## Files

- `src/utils/logger.ts` - Logger utility implementation
- `App.tsx` - Log level configuration
