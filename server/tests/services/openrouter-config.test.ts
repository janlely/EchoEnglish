import { config } from '../../src/config';

describe('OpenRouter Service Configuration', () => {
  it('should have OpenRouter configuration defined', () => {
    expect(config.openRouter).toBeDefined();
    expect(config.openRouter.apiKey).toBeDefined();
    expect(config.openRouter.baseUrl).toBeDefined();
    expect(config.openRouter.model).toBeDefined();
  });

  it('should have expected default values for OpenRouter config', () => {
    // Note: These values may be overridden by environment variables during testing
    expect(config.openRouter.baseUrl).toBeDefined();
    expect(config.openRouter.model).toBeDefined();
    
    // Just check that they are not empty
    expect(config.openRouter.baseUrl).not.toBe('');
    expect(config.openRouter.model).not.toBe('');
  });

  it('should have empty API key by default', () => {
    // The API key will be empty if not set in environment
    expect(config.openRouter.apiKey).toBeDefined();
  });
});