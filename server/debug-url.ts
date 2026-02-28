import { config } from './src/config';

console.log('Checking config values:');
console.log('Original URL:', JSON.stringify(config.openRouter.baseUrl));
console.log('Length:', config.openRouter.baseUrl.length);
console.log('Characters codes:', Array.from(config.openRouter.baseUrl).map(c => c.charCodeAt(0)));
console.log('Trimmed URL:', JSON.stringify(config.openRouter.baseUrl.trim()));
console.log('Trimmed Length:', config.openRouter.baseUrl.trim().length);

// Show character codes in hex for easier identification
console.log('Character codes (hex):', Array.from(config.openRouter.baseUrl).map(c => '0x' + c.charCodeAt(0).toString(16)));