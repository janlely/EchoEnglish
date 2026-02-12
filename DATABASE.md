# Database Design for EchoEnglish App

This document outlines the database design for the EchoEnglish app using WatermelonDB.

## Overview

WatermelonDB is a reactive database for powerful React and React Native apps, designed to scale up from zero to millions of records.

## Schema Design

### Tables

#### 1. `users`
Stores user information.

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier for the user |
| name | string | User's display name |
| email | string | User's email address (optional) |
| avatar_url | string | URL to user's profile picture (optional) |
| is_online | boolean | Whether the user is currently online (optional) |
| created_at | number | Timestamp when the record was created |
| updated_at | number | Timestamp when the record was last updated |

#### 2. `chat_sessions`
Represents chat conversations (both direct messages and group chats).

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier for the chat session |
| name | string | Name of the chat (contact name or group name) |
| type | string | Type of chat ('direct' or 'group') |
| last_message_id | string | ID of the most recent message in the chat (optional) |
| unread_count | number | Number of unread messages (optional) |
| is_archived | boolean | Whether the chat is archived (optional) |
| is_muted | boolean | Whether notifications are muted for this chat (optional) |
| avatar_url | string | URL to the chat's avatar (optional) |
| created_at | number | Timestamp when the record was created |
| updated_at | number | Timestamp when the record was last updated |

#### 3. `messages`
Stores individual messages within chat sessions.

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier for the message |
| text | string | The content of the message |
| sender_id | string | ID of the user who sent the message |
| chat_session_id | string | ID of the chat session this message belongs to |
| status | string | Status of the message ('sent', 'delivered', 'read') |
| timestamp | number | Time when the message was sent |
| reply_to_message_id | string | ID of the message this message is replying to (optional) |
| media_url | string | URL to attached media (optional) |
| media_type | string | Type of media ('image', 'video', 'audio', 'document') (optional) |
| created_at | number | Timestamp when the record was created |
| updated_at | number | Timestamp when the record was last updated |

#### 4. `chat_participants`
Links users to chat sessions, representing who participates in which chat.

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier for the participant record |
| chat_session_id | string | ID of the chat session |
| user_id | string | ID of the user participating in the chat |
| role | string | Role of the user in the chat ('admin', 'member', etc.) (optional) |
| joined_at | number | Timestamp when the user joined the chat |
| left_at | number | Timestamp when the user left the chat (optional) |
| created_at | number | Timestamp when the record was created |
| updated_at | number | Timestamp when the record was last updated |

#### 5. `user_settings`
Stores user-specific settings and preferences.

| Column | Type | Description |
|--------|------|-------------|
| id | string | Unique identifier for the setting record |
| key | string | Key for the setting |
| value | string | Value of the setting |
| user_id | string | ID of the user this setting belongs to (optional) |
| created_at | number | Timestamp when the record was created |
| updated_at | number | Timestamp when the record was last updated |

## Relationships

- A `User` has many `Message`s (one-to-many)
- A `User` has many `ChatParticipant`s (one-to-many)
- A `ChatSession` has many `Message`s (one-to-many)
- A `ChatSession` has many `ChatParticipant`s (one-to-many)
- A `Message` belongs to a `User` (many-to-one)
- A `Message` belongs to a `ChatSession` (many-to-one)
- A `ChatParticipant` belongs to a `ChatSession` (many-to-one)
- A `ChatParticipant` belongs to a `User` (many-to-one)
- A `UserSetting` belongs to a `User` (many-to-one)

## Usage

### Accessing the Database

```javascript
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Q } from '@nozbe/watermelondb';

const MyComponent = () => {
  const database = useDatabase();
  
  // Query data
  const fetchChatSessions = async () => {
    const chatSessions = await database.collections
      .get('chat_sessions')
      .query()
      .fetch();
    
    return chatSessions;
  };
  
  // Create data
  const createNewMessage = async (text, chatSessionId) => {
    await database.write(async () => {
      await database.collections.get('messages').create(message => {
        message.text = text;
        message.chatSessionId = chatSessionId;
        message.senderId = 'current_user_id';
        message.status = 'sent';
        message.timestamp = Date.now();
      });
    });
  };
  
  return (
    // Component JSX
  );
};
```

### Observing Changes

WatermelonDB supports reactive programming patterns:

```javascript
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Q } from '@nozbe/watermelondb';

const MyComponent = () => {
  const database = useDatabase();
  
  // Observe changes to chat sessions
  const [chatSessions, setChatSessions] = useState([]);
  
  useEffect(() => {
    const subscription = database.collections
      .get('chat_sessions')
      .query()
      .observe()
      .subscribe(setChatSessions);
    
    return () => subscription.unsubscribe();
  }, [database]);
  
  // chatSessions will automatically update when the database changes
  return (
    // Component JSX
  );
};
```

## Initialization

The database is initialized with sample data when the app starts. This is handled in `src/database/initialize.ts`.

## Best Practices

1. Always use `database.write()` for write operations
2. Use `useDatabase()` hook to access the database in components
3. Subscribe to queries with `.observe()` for reactive updates
4. Always unsubscribe from observables to prevent memory leaks
5. Handle errors appropriately when performing database operations