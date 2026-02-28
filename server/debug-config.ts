import { config } from './src/config';

console.log('Current OpenRouter Base URL:', config.openRouter.baseUrl);
console.log('Current OpenRouter Model:', config.openRouter.model);
console.log('API Key Present?', !!config.openRouter.apiKey && config.openRouter.apiKey.length > 0);