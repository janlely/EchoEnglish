import openRouterService from '../../src/services/openrouter.service';
import { config } from '../../src/config';

describe('OpenRouter Service Integration', () => {
  // Only run these tests if API key is configured
  const hasApiKey = config.openRouter?.apiKey && config.openRouter.apiKey.trim() !== '';

  if (!hasApiKey) {
    console.log('Skipping OpenRouter integration tests - API key not configured');
  }

  it('should have OpenRouter configuration with API key', () => {
    expect(config.openRouter).toBeDefined();
    expect(config.openRouter.apiKey).toBeDefined();
    if (hasApiKey) {
      expect(config.openRouter.apiKey).not.toBe('');
    }
  });

  it('should analyze simple input successfully', async () => {
    if (!hasApiKey) {
      console.log('Skipping test - OPENROUTER_API_KEY not configured in environment');
      return;
    }

    const result = await openRouterService.analyze({
      input: 'Hello, how are you?',
      contextMessages: [] // Empty context for simple test
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    console.log('Simple analysis result length:', result.length);
  }, 30000); // 30 second timeout for API call

  it('should analyze input with context successfully', async () => {
    if (!hasApiKey) {
      console.log('Skipping test - OPENROUTER_API_KEY not configured in environment');
      return;
    }

    const result = await openRouterService.analyze({
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

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    console.log('Context analysis result length:', result.length);
  }, 30000); // 30 second timeout for API call

  it('should stream analyze input successfully', (done) => {
    if (!hasApiKey) {
      console.log('Skipping test - OPENROUTER_API_KEY not configured in environment');
      done();
      return;
    }

    let fullContent = '';
    let receivedStart = false;
    let receivedText = false;
    let receivedDone = false;

    const timeout = setTimeout(() => {
      done(new Error('Test timed out'));
    }, 45000); // 45 second timeout for streaming test

    openRouterService.streamAnalyze(
      {
        input: 'Count from 1 to 5',
        contextMessages: []
      },
      {
        onStart: () => {
          receivedStart = true;
          console.log('Stream started');
        },
        onText: (text: string) => {
          receivedText = true;
          fullContent += text;
          console.log('Received text chunk:', text.substring(0, 20) + '...');
        },
        onSuggestion: (text: string, highlight: string) => {
          console.log('Received suggestion:', text, highlight);
        },
        onDone: () => {
          receivedDone = true;
          clearTimeout(timeout);
          
          expect(fullContent).toBeDefined();
          expect(fullContent.length).toBeGreaterThan(0);
          expect(receivedStart).toBeTruthy();
          expect(receivedText).toBeTruthy();
          expect(receivedDone).toBeTruthy();
          
          console.log('Streaming completed, total content length:', fullContent.length);
          done();
        },
        onError: (error: string) => {
          clearTimeout(timeout);
          done(new Error(`Stream error: ${error}`));
        },
      }
    );
  }, 50000); // 50 second timeout for streaming test
});