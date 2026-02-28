#!/usr/bin/env ts-node
import openRouterService from './src/services/openrouter.service';
import { config } from './src/config';

async function testOpenRouter() {
  console.log('Testing OpenRouter integration...\n');

  // Check if API key is configured
  if (!config.openRouter?.apiKey || config.openRouter.apiKey.trim() === '') {
    console.log('❌ ERROR: OPENROUTER_API_KEY is not configured in environment');
    console.log('Please set OPENROUTER_API_KEY in your .env file');
    process.exit(1);
  }

  console.log('✅ API key is configured');

  // Test 1: Simple analysis
  try {
    console.log('\n📝 Testing simple analysis...');
    const simpleResult = await openRouterService.analyze({
      input: 'Hello, how are you?',
      contextMessages: []
    });
    console.log('✅ Simple analysis successful');
    console.log('Response preview:', simpleResult.substring(0, 100) + '...');
  } catch (error) {
    console.log('❌ Simple analysis failed:', error);
  }

  // Test 2: Analysis with context
  try {
    console.log('\n💬 Testing analysis with context...');
    const contextResult = await openRouterService.analyze({
      input: 'I am happy',
      contextMessages: [
        {
          text: 'How was your day?',
          senderId: 'user1',
          isMe: false,
          timestamp: Date.now() - 10000,
        },
        {
          text: 'It was good!',
          senderId: 'user2',
          isMe: true,
          timestamp: Date.now() - 5000,
        }
      ]
    });
    console.log('✅ Context analysis successful');
    console.log('Response preview:', contextResult.substring(0, 100) + '...');
  } catch (error) {
    console.log('❌ Context analysis failed:', error);
  }

  // Test 3: Streaming analysis
  try {
    console.log('\n📡 Testing streaming analysis...');
    let fullContent = '';
    let receivedText = false;
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Streaming test timed out'));
      }, 30000);
      
      openRouterService.streamAnalyze(
        {
          input: 'Count from 1 to 3',
          contextMessages: []
        },
        {
          onStart: () => {
            console.log('Stream started');
          },
          onText: (text) => {
            receivedText = true;
            fullContent += text;
            process.stdout.write(text); // Print the streamed text
          },
          onSuggestion: (text, highlight) => {
            console.log('\nSuggestion received:', text, '-', highlight);
          },
          onDone: () => {
            clearTimeout(timeout);
            console.log('\n✅ Streaming analysis completed');
            console.log('Total content length:', fullContent.length);
            resolve(undefined);
          },
          onError: (error) => {
            clearTimeout(timeout);
            reject(new Error(`Stream error: ${error}`));
          },
        }
      );
    });
    
    console.log('✅ Streaming test successful');
  } catch (error) {
    console.log('❌ Streaming test failed:', error);
  }

  console.log('\n🎉 OpenRouter integration test completed!');
}

// Run the test
testOpenRouter().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});