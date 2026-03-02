import fetch from 'node-fetch';
import { Readable } from 'stream';
import { config } from '../config';
import logger from '../utils/logger';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ContextMessage {
  text: string;
  senderId: string;
  isMe: boolean;
  timestamp: number;
}

interface AnalyzeOptions {
  input: string;
  contextMessages: ContextMessage[];
}

interface StreamCallbacks {
  onStart?: () => void;
  onText?: (text: string) => void;
  onSuggestion?: (text: string, highlight: string) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
}

interface TranslateCallbacks {
  onStart?: () => void;
  onText?: (text: string) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
}

const TRANSLATION_PROMPT = `You are a professional English to Chinese translator. Your task is to translate chat messages from English to Chinese.

Requirements:
- Translate naturally and conversationally
- Keep the original meaning and tone
- Do not add any explanations or comments
- Output ONLY the translation, nothing else
- Translate English text to Chinese (简体中文)`;

const SYSTEM_PROMPT = `你是一个专业的英语学习助手，精通英语和中文。你的角色是帮助用户在聊天中学习和使用英语。
你会根据聊天上下文理解用户的表达意图，提供准确的英语建议，并用中文进行讲解。

回复格式要求：
1. 先用中文简要分析上下文和用户意图（1-2句话）
2. 用中文提供英语建议或纠错
3. 使用 Markdown 格式和 emoji 讓回复更易读

如果用户输入是英语：
- 检查语法和用词是否正确
- 正确则赞赏，有误则温和指出并纠正
- 可以提供更地道的替代表达

如果用户输入不是英语：
- 理解用户意图（结合上下文）
- 提供 2-3 个建议的英语表达
- 用中文说明每个表达的使用场景

格式要求：
- 使用 Markdown 格式（如 **加粗**、*斜体*、标题 # 等）
- 可以使用 emoji 增加可读性
- 用空行分隔段落

重要：在所有内容结束后，输出一小段特殊文本标记，然后把前端的2-3个建议按行输出，每行一个:
===SUGGESTIONS===
英语表达内容建议1
英语表达内容建议2
英语表达内容建议3

请严格按照此格式输出，确保普通内容和 JSON 建议之间有明确分隔。`;

class OpenRouterService {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = config.openRouter?.apiKey || '';
    this.baseUrl = (config.openRouter?.baseUrl || 'https://openrouter.ai/api/v1').trim();
    this.model = config.openRouter?.model || 'openai/gpt-4o-mini';
  }

  /**
   * Build messages array for the chat completion API
   */
  private buildMessages(options: AnalyzeOptions): ChatMessage[] {
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    // Add context messages if available
    if (options.contextMessages && options.contextMessages.length > 0) {
      const contextText = options.contextMessages
        .filter(msg => msg.text && msg.text.trim() !== '')  // Filter out empty messages
        .map(msg => `${msg.isMe ? '我' : '对方'}: ${msg.text || ''}`)
        .join('\n');
      
      // Only add context if there's actual content
      if (contextText && contextText.trim() !== '') {
        messages.push({
          role: 'user',
          content: `[聊天上下文]\n${contextText}\n\n[我的输入]\n${options.input}`
        });
      } else {
        // If no context messages, just send the input
        messages.push({
          role: 'user',
          content: `[我的输入]\n${options.input}`
        });
      }
    } else {
      messages.push({
        role: 'user',
        content: `[我的输入]\n${options.input}`
      });
    }

    return messages;
  }

  /**
   * Stream analyze the user's input
   */
  async streamAnalyze(options: AnalyzeOptions, callbacks: StreamCallbacks): Promise<void> {
    if (!this.apiKey) {
      callbacks.onError?.('OpenRouter API key not configured');
      return;
    }

    const messages = this.buildMessages(options);
    
    logger.info('[OpenRouter] Starting stream analyze for input:', options.input.substring(0, 50));

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://echoenglish.app',
          'X-Title': 'EchoEnglish Assistant'
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[OpenRouter] API error:', response.status, errorText);
        callbacks.onError?.(`API error: ${response.status}`);
        return;
      }

      if (!response.body) {
        callbacks.onError?.('No response body');
        return;
      }

      callbacks.onStart?.();
      logger.info('[OpenRouter] Stream started');

      // Flag to ensure onDone is only called once
      let doneCalled = false;
      const callDoneOnce = () => {
        if (!doneCalled) {
          doneCalled = true;
          logger.info('[OpenRouter] Stream completed');
          callbacks.onDone?.();
        }
      };

      // Handle streaming response using node-fetch approach
      const body = response.body;
      if (!body) {
        callbacks.onError?.('No response body');
        return;
      }

      // Node.js streams approach
      const decoder = new TextDecoder();
      let buffer = '';

      // Cast body to Node.js readable stream
      const nodeStream = body as any;

      nodeStream.on('data', (chunk: Buffer) => {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') {
            if (trimmedLine === 'data: [DONE]') {
              callDoneOnce();
            }
            continue;
          }

          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.slice(6);

              // Special handling for [DONE] marker
              if (jsonStr === '[DONE]') {
                callDoneOnce();
                continue;
              }

              const data = JSON.parse(jsonStr);

              if (data.choices && data.choices[0]?.delta?.content) {
                const content = data.choices[0].delta.content;

                // Check for suggestion pattern in the content
                let processedContent = content;
                const suggestionRegex = /👉\s*\{"suggestion":\s*"([^"]+)",\s*"highlight":\s*"([^"]+)"}/g;
                let match: RegExpExecArray | null;
                while ((match = suggestionRegex.exec(processedContent)) !== null) {
                  // Extract suggestion and highlight
                  const suggestionText = match[1];
                  const highlight = match[2];

                  // Send suggestion event
                  callbacks.onSuggestion?.(suggestionText, highlight);

                  // Remove the suggestion JSON from the text content to prevent duplicate processing
                  processedContent = processedContent.replace(match[0], '👉 **点击选择**');
                }

                // Send text chunk
                callbacks.onText?.(processedContent);
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete JSON
              // console.error('Parse error:', parseError);
            }
          }
        }
      });

      nodeStream.on('end', () => {
        callDoneOnce();
      });

      nodeStream.on('error', (error: Error) => {
        logger.error('[OpenRouter] Stream error:', error);
        callbacks.onError?.(error.message);
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[OpenRouter] Request error:', errorMessage);
      callbacks.onError?.(errorMessage);
    }
  }

  /**
   * Non-streaming analyze (for simpler use cases)
   */
  async analyze(options: AnalyzeOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const messages = this.buildMessages(options);

    logger.info('[OpenRouter] Starting analyze for input:', options.input.substring(0, 50));

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://echoenglish.app',
        'X-Title': 'EchoEnglish Assistant'
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[OpenRouter] API error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Stream translation from Chinese to English
   */
  async streamTranslate(
    text: string,
    callbacks: TranslateCallbacks
  ): Promise<void> {
    if (!this.apiKey) {
      callbacks.onError?.('OpenRouter API key not configured');
      return;
    }

    try {
      logger.info('[OpenRouter] Starting translation stream for text:', text.substring(0, 50));

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://echoenglish.app',
          'X-Title': 'EchoEnglish Translator',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: TRANSLATION_PROMPT },
            { role: 'user', content: text }
          ],
          max_tokens: 500,
          temperature: 0.3,
          stream: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[OpenRouter] Translation API error:', response.status, errorText);
        callbacks.onError?.(`API error: ${response.status}`);
        return;
      }

      callbacks.onStart?.();

      // Get the response body as a stream
      const responseBody = response.body;
      if (!responseBody) {
        callbacks.onError?.('No response body');
        return;
      }

      // Convert to Node.js Readable stream
      const nodeStream = Readable.from(responseBody as any);

      let buffer = '';

      nodeStream.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        buffer += text;

        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') {
            continue;
          }

          // Parse SSE data
          if (trimmedLine.startsWith('data: ')) {
            const dataStr = trimmedLine.substring(6);
            try {
              const data = JSON.parse(dataStr);
              const content = data.choices?.[0]?.delta?.content || '';
              if (content) {
                callbacks.onText?.(content);
              }
            } catch (e) {
              // Ignore parse errors for malformed JSON
            }
          }
        }
      });

      nodeStream.on('end', () => {
        logger.info('[OpenRouter] Translation stream completed');
        callbacks.onDone?.();
      });

      nodeStream.on('error', (error: Error) => {
        logger.error('[OpenRouter] Translation stream error:', error);
        callbacks.onError?.(error.message);
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[OpenRouter] Translation request error:', errorMessage);
      callbacks.onError?.(errorMessage);
    }
  }
}

export default new OpenRouterService();