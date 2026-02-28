import openRouterService from '../../src/services/openrouter.service';
import { config } from '../../src/config';

describe('OpenRouter Service', () => {
  // Skip tests if API key is not configured
  const hasApiKey = config.openRouter?.apiKey && config.openRouter.apiKey !== '';

  it('should have OpenRouter configuration', () => {
    expect(config.openRouter).toBeDefined();
    expect(config.openRouter.apiKey).toBeDefined();
  });

  it('should analyze simple input', async () => {
    if (!hasApiKey) {
      console.log('Skipping test - OPENROUTER_API_KEY not configured');
      return;
    }

    const result = await openRouterService.analyze({
      input: 'Hello, how are you?',
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    console.log('Analysis result:', result.substring(0, 100) + '...');
  }, 15000); // Increase timeout for API call

  it('should analyze input with context', async () => {
    if (!hasApiKey) {
      console.log('Skipping test - OPENROUTER_API_KEY not configured');
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
        }
      ]
    });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    console.log('Context analysis result:', result.substring(0, 100) + '...');
  }, 15000); // Increase timeout for API call

  it('should stream analyze input', (done) => {
    if (!hasApiKey) {
      console.log('Skipping test - OPENROUTER_API_KEY not configured');
      done();
      return;
    }

    let fullContent = '';
    let receivedStart = false;
    let receivedText = false;
    let receivedDone = false;

    openRouterService.streamAnalyze(
      {
        input: 'Count from 1 to 5',
      },
      {
        onStart: () => {
          receivedStart = true;
        },
        onText: (text: string) => {
          receivedText = true;
          fullContent += text;
        },
        onSuggestion: (text: string, highlight: string) => {
          console.log('Received suggestion:', text, highlight);
        },
        onDone: () => {
          receivedDone = true;
          expect(fullContent).toBeDefined();
          expect(fullContent.length).toBeGreaterThan(0);
          expect(receivedStart).toBeTruthy();
          expect(receivedText).toBeTruthy();
          expect(receivedDone).toBeTruthy();
          done();
        },
        onError: (error: string) => {
          done.fail(`Stream error: ${error}`);
        },
      }
    );
  }, 20000); // Increase timeout for streaming test
});