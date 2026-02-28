import { config } from './src/config';
import fetch from 'node-fetch';

async function testDetailedAPICall() {
  console.log('Testing detailed API call...\n');

  const apiKey = config.openRouter.apiKey;
  const baseUrl = (config.openRouter.baseUrl || 'https://openrouter.ai/api/v1').trim();
  const model = config.openRouter.model || 'openai/gpt-4o-mini';

  console.log('Using API Key:', apiKey ? 'YES (first 10 chars: ' + apiKey.substring(0, 10) + '...)' : 'NO');
  console.log('Using Base URL:', baseUrl);
  console.log('Using Model:', model);

  // Test with a minimal payload
  const requestBody = {
    model: model,
    messages: [
      { role: 'user', content: 'Hello' }
    ],
    stream: true
  };

  console.log('\nRequest body:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://echoenglish.app',
        'X-Title': 'EchoEnglish Assistant'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('\nResponse status:', response.status);
    console.log('Response status text:', response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response body:', errorText);
    } else {
      console.log('Response OK - checking content...');
      
      // Try to read the stream
      if (response.body) {
        const reader = response.body;
        let buffer = '';
        
        reader.on('data', (chunk) => {
          buffer += chunk.toString();
          console.log('Received chunk:', chunk.toString().substring(0, 100) + '...');
        });
        
        reader.on('end', () => {
          console.log('Stream ended. Full buffer:', buffer);
        });
        
        reader.on('error', (err) => {
          console.error('Stream error:', err);
        });
      } else {
        console.log('No response body');
      }
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

testDetailedAPICall();