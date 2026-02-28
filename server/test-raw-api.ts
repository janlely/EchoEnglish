import fetch from 'node-fetch';
import { config } from './src/config';

console.log('Testing raw API connection...');

async function testRawAPI() {
  const apiKey = config.openRouter.apiKey;
  const baseUrl = config.openRouter.baseUrl.trim(); // 注意这里使用 trim()
  const model = config.openRouter.model;
  
  console.log('Using Base URL:', `"${baseUrl}"`);
  console.log('URL length:', baseUrl.length);
  console.log('Last 10 chars:', baseUrl.slice(-10));
  
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      })
    });
    
    console.log('Response status:', response.status);
    console.log('Response status text:', response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response:', errorText);
    } else {
      const data = await response.json();
      console.log('Success response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

testRawAPI();