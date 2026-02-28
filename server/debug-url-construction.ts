import { config } from './src/config';
import openRouterService from './src/services/openrouter.service';

console.log('Testing the actual URL construction...');

// Create an instance to check the URL
const testService = new (class {
  private baseUrl: string;

  constructor() {
    this.baseUrl = (config.openRouter?.baseUrl || 'https://openrouter.ai/api/v1').trim();
  }

  testUrlConstruction() {
    console.log('Base URL:', this.baseUrl);
    console.log('Full API URL:', `${this.baseUrl}/chat/completions`);
    console.log('Base URL length:', this.baseUrl.length);
    console.log('Last 10 chars of base URL:', this.baseUrl.slice(-10));
    
    // Check for any problematic characters
    const problematicChars = /[^\x20-\x7E]/g;
    const matches = this.baseUrl.match(problematicChars);
    if (matches) {
      console.log('Found problematic characters:', matches);
    } else {
      console.log('No problematic characters found in base URL');
    }
  }
})();

testService.testUrlConstruction();