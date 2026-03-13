#!/usr/bin/env ts-node
/**
 * Sender Test Script
 *
 * This script simulates a sender account to send messages for testing
 * the receiver's real-time message handling flow.
 *
 * Usage:
 *   npm run sender:test -- --email=test@example.com --password=123456 --targetUserId=user123
 *
 * After login, type your message and press Enter to send.
 * Press Ctrl+C to exit.
 */

import * as readline from 'readline';
import fetch from 'node-fetch';
import { io, Socket } from 'socket.io-client';
import { config } from './src/config';

// Command line arguments parsing
const args = process.argv.slice(2);
const argMap: Record<string, string> = {};

args.forEach((arg, index) => {
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    // Handle both --key=value and --key value formats
    if (arg.includes('=')) {
      const [k, v] = arg.slice(2).split('=');
      argMap[k] = v;
    } else {
      const value = args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : 'true';
      argMap[key] = value;
    }
  }
});

const EMAIL = argMap['email'] || process.env.SENDER_EMAIL || '';
const PASSWORD = argMap['password'] || process.env.SENDER_PASSWORD || '';
const TARGET_USER_ID = argMap['targetUserId'] || process.env.TARGET_USER_ID || '';

if (!EMAIL || !PASSWORD || !TARGET_USER_ID) {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    Sender Test Script                      ║
╠═══════════════════════════════════════════════════════════╣
║ Usage:                                                     ║
║   npm run sender:test -- [options]                         ║
║                                                            ║
║ Options:                                                   ║
║   --email <email>        Sender's email (required)         ║
║   --password <password>  Sender's password (required)      ║
║   --targetUserId <id>    Target user ID to send to        ║
║                                                            ║
║ Environment Variables:                                     ║
║   SENDER_EMAIL                                             ║
║   SENDER_PASSWORD                                          ║
║   TARGET_USER_ID                                           ║
║                                                            ║
║ Examples:                                                  ║
║   npm run sender:test -- --email=test@example.com \\       ║
║     --password=123456 --targetUserId=user123               ║
╚═══════════════════════════════════════════════════════════╝
  `);
  process.exit(1);
}

const BASE_URL = `http://localhost:${config.port || 3000}`;
const WS_URL = `http://localhost:${config.port || 3000}`;

let accessToken: string = '';
let userId: string = '';
let conversationId: string = '';
let socket: Socket | null = null;
let messageCounter = 0;
let rl: readline.Interface;

/**
 * Login and get access token
 */
async function login(): Promise<{ accessToken: string; userId: string }> {
  console.log('\n📝 Logging in...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    accessToken = data.data.accessToken;
    userId = data.data.user.id;

    console.log(`✅ Login successful!`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Email: ${EMAIL}`);

    return { accessToken, userId };
  } catch (error: any) {
    console.error(`❌ Login failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get or create direct conversation with target user
 */
async function getOrCreateConversation(targetUserId: string): Promise<string> {
  console.log('\n💬 Getting or creating conversation...');

  try {
    const response = await fetch(`${BASE_URL}/api/chats/conversations/direct/${targetUserId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data = await response.json() as any;

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get conversation');
    }

    const conversationId = data.data?.conversation?.conversationId || data.data?.conversation?.id;
    
    if (!conversationId) {
      throw new Error('Conversation ID not found in response');
    }

    console.log(`✅ Conversation ID: ${conversationId}`);

    return conversationId;
  } catch (error: any) {
    console.error(`❌ Failed to get conversation: ${error.message}`);
    throw error;
  }
}

/**
 * Send message via HTTP API
 */
async function sendMessageHttp(text: string): Promise<void> {
  const msgId = `test_${Date.now()}_${messageCounter}`;

  try {
    const response = await fetch(`${BASE_URL}/api/chats/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        text,
        type: 'text',
        msgId,
        chatType: 'direct',
      }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send message');
    }

    console.log(`\n✅ Message sent (HTTP): "${text}" [msgId: ${msgId}, seq: ${data.data.message?.seq || 'N/A'}]`);
    console.log(`\n${'='.repeat(60)}`);
  } catch (error: any) {
    console.error(`❌ Failed to send message (HTTP): ${error.message}`);
    throw error;
  }
}

/**
 * Connect to WebSocket server
 */
async function connectWebSocket(): Promise<Socket> {
  console.log('\n🔌 Connecting to WebSocket...');

  return new Promise((resolve, reject) => {
    const ws = io(WS_URL, {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    ws.on('connect', () => {
      console.log(`✅ WebSocket connected: ${ws.id}`);
      resolve(ws);
    });

    ws.on('connect_error', (error: any) => {
      console.error(`❌ WebSocket connection error: ${error.message}`);
      reject(error);
    });

    ws.on('error', (error: any) => {
      console.error(`❌ WebSocket error: ${error.message}`);
    });

    ws.on('message_sent', (data: any) => {
      console.log(`📨 Message confirmation:`, data);
    });

    setTimeout(() => {
      if (!ws.connected) {
        reject(new Error('WebSocket connection timeout'));
      }
    }, 10000);
  });
}

/**
 * Send message via WebSocket
 */
async function sendMessageWebSocket(text: string): Promise<void> {
  if (!socket) {
    throw new Error('WebSocket not connected');
  }

  const msgId = `test_${Date.now()}_${messageCounter}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Send message timeout'));
    }, 10000);

    socket!.once('message_sent', (data: any) => {
      clearTimeout(timeout);
      console.log(`\n✅ Message sent: "${text}" [msgId: ${msgId}, seq: ${data.seq || 'N/A'}]`);
      console.log(`\n${'='.repeat(60)}`);
      resolve();
    });

    socket!.emit('send_message', {
      targetId: conversationId,
      text,
      type: 'text',
      msgId,
      chatType: 'direct',
    });

    socket!.once('error', (error: any) => {
      clearTimeout(timeout);
      console.error(`\n❌ WebSocket send error: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Send a single message
 */
async function sendMessage(text: string): Promise<void> {
  messageCounter++;

  if (socket) {
    await sendMessageWebSocket(text);
  } else {
    await sendMessageHttp(text);
  }
}

/**
 * Main test function
 */
async function runTest() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║              Sender Test Script Started                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Login
    await login();

    // Step 2: Get or create conversation
    conversationId = await getOrCreateConversation(TARGET_USER_ID);

    // Step 3: Connect to WebSocket (optional, for real-time testing)
    try {
      socket = await connectWebSocket();
      console.log('\n💡 Using WebSocket for sending messages\n');
    } catch (error: any) {
      console.log(`\n⚠️  WebSocket connection failed, falling back to HTTP API\n`);
      socket = null;
    }

    // Step 4: Start interactive input
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  Type your message and press Enter to send                ║');
    console.log('║  Press Ctrl+C to exit                                     ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // Listen for incoming messages (to verify seq is working)
    if (socket) {
      socket.on('receive_message', (data: any) => {
        console.log(`\n📨 Received message: "${data.text}" [seq: ${data.seq || 'N/A'}]`);
        console.log(`\n${'='.repeat(60)}`);
      });
      console.log('👂 Listening for incoming messages...\n');
    }

    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Handle Ctrl+C
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Exiting sender test...');
      await cleanup();
      process.exit(0);
    });

    // Start reading input
    promptForInput();
  } catch (error: any) {
    console.error(`\n❌ Test failed: ${error.message}\n`);
    await cleanup();
    process.exit(1);
  }
}

/**
 * Prompt user for input
 */
function promptForInput() {
  rl.question('📝 Message: ', async (answer: string) => {
    const text = answer.trim();
    
    if (text) {
      try {
        await sendMessage(text);
      } catch (error: any) {
        console.error(`❌ Failed to send: ${error.message}`);
      }
    } else {
      console.log('⚠️  Empty message, please type something');
    }
    
    promptForInput();
  });
}

/**
 * Cleanup resources
 */
async function cleanup() {
  if (rl) {
    rl.close();
  }
  if (socket) {
    console.log('\n🔌 Disconnecting WebSocket...');
    socket.disconnect();
    socket = null;
  }
  console.log('✅ Cleanup completed\n');
}

// Run the test
runTest().catch(err => {
  console.error('Test execution error:', err);
  cleanup().finally(() => process.exit(1));
});
