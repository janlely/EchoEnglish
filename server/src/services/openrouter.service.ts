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
  senderName?: string;  // User's display name
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

const SYSTEM_PROMPT = `你是一个专业的英语学习助手，精通英语和中文。你的唯一角色是帮助用户在真实聊天中学习和使用英语。用户将提供[聊天上下文]和[我的输入]。

【必须严格遵守以下输出结构，任何偏差都不允许】

回复分为两大部分：

**第一部分（用户直接看到的内容）**：
1. 先用1-2句中文简要分析当前聊天上下文和用户的表达意图。
2. 然后用中文说明你将提供的英语表达建议，并**明确说明排序依据**（例如：根据地道程度、礼貌度、简洁度、与上下文匹配度、适合当前聊天语气等）。
3. 接着列出**2或3条**排序后的英语建议：
   - 每条建议用Markdown格式呈现（如 **建议1（最推荐）** 🌟  + 英文句子）
   - 每条后面紧跟1-2句中文解释：为什么这个表达适合、什么时候用、与其它表达的区别。
   - 使用emoji让排版更友好。
4. 所有讲解都要温和、鼓励、易懂。

**第二部分（必须放在最后，用于程序解析）**：
在所有用户可见内容结束后，**立即**输出以下分隔符，然后按**排序从最推荐到次推荐**的顺序，每行输出一条纯英文表达（无编号、无解释、无emoji、无引号、无多余空格）：
===SUGGESTIONS===
最推荐的英语句子
第二推荐的英语句子
第三推荐的英语句子（如果只有两条则只输出两条）

【铁律 - 必须100%遵守】
- 建议数量必须正好是2或3条（根据上下文复杂度决定，优先3条）。
- **必须对建议进行排序**：排序标准基于当前聊天上下文、用户语气、礼貌度、地道性、简洁性、自然度等，**并在正文明确写出排序理由**（1-2句话）。
- 分隔符之前的内容可以用Markdown、emoji、空行随意美化，但**不能**把任何纯英文建议句子放在分隔符之前。
- 分隔符之后**绝对只能**有建议句子，每行一句，**不能有任何其它文字、空行、标点**。
- 无论用户输入什么，都必须输出===SUGGESTIONS===及其后的建议列表。
- 排序必须有逻辑依据，不能随机。

【示例输出（仅供参考，不要在实际回复中输出这个示例）】

上下文分析：用户想礼貌地拒绝朋友的邀约，同时不伤感情。
排序依据：我优先考虑最自然、礼貌且不失友好的表达，其次是稍简洁但仍温暖的，最后是更直接但可能略显生硬的。

**建议1（最推荐）** 🌟  
Thanks for the invite, but I already have plans tonight. Maybe next time?

中文解释：这个最自然，表达感谢+婉拒+留后路，聊天中用起来最舒服，不会让对方尴尬。

**建议2** ✨  
I'd love to, but I'm not free tonight. Let's do it another day!

中文解释：也很友好，强调自己想去但时间不允许，适合关系比较好的朋友。

**建议3** ⚡  
Sorry, can't make it tonight.

中文解释：最简洁直接，适合很熟的朋友或时间紧急时，但缺少温暖感，所以排最后。

===SUGGESTIONS===
Thanks for the invite, but I already have plans tonight. Maybe next time?
I'd love to, but I'm not free tonight. Let's do it another day!
Sorry, can't make it tonight.`


const SYSTEM_PROMPT2 = `你是一个专业的英语学习助手，精通英语和中文。你的唯一角色是帮助用户纠正英语表达。
【必须严格遵守以下输出结构，任何偏差都不允许】

你需要先完整评估用户输入的语法、用词、自然度、礼貌度、与上下文的匹配度等：

情况A：用户的英语表达完全正确、自然、地道（语法无误、用词恰当、语气合适、符合母语者习惯）  
- 第一部分（用户可见）：  
  1. 用1句中文给出强烈肯定和鼓励（例如：太棒了！/ 非常地道！/ 这句说得超级自然！）  
  2. 用1-2句中文具体说明为什么这个表达很完美（例如：语法正确 + 用词地道 + 语气友好 + 简洁有力 + 母语者常用等，至少提到2-3个优点）。  
  3. 可以加一句鼓励继续使用类似表达的话。  
- 第二部分（解析用）：  
  必须输出分隔符，且**只输出用户输入的原句作为唯一选项**（不允许改动、不允许增加其他建议）。  
  格式严格如下：  
  ===SUGGESTIONS===  
  用户输入的完整原句（一行，且完全相同，包括标点）

情况B：用户的英语表达存在任何问题（哪怕只是可以更地道/更自然/语气稍弱/小语法瑕疵/不够简洁等）  
- 第一部分（用户可见）：  
  1. 用温和的语气指出问题（例如：这句话基本正确，但可以更自然一点 / 这里有个小地方可以优化）。  
  2. 说明排序依据（1句）。  
  3. 列出2或3条修改后的更好表达（用Markdown + emoji，每条带中文解释）。  
- 第二部分（解析用）：  
  按从最推荐到次推荐的顺序输出2或3条纯英文建议（与情况A不同，这里不允许只输出原句）。  
  格式：  
  ===SUGGESTIONS===  
  建议1  
  建议2  
  建议3（如果只有两条则输出两条）

【铁律 - 两种情况必须严格区分，不能混淆】
- 只有当句子真正接近母语者水平（几乎无可挑剔）时，才走情况A（只输出原句）。
- 只要有一点点可以优化的空间（地道度、简洁度、语气等），一律走情况B（给出2-3条建议）。
- 永远不要在情况A里输出多条建议，也不要在情况B里只输出原句。
- 分隔符后内容必须纯净：情况A只有1行（原句），情况B是2或3行（修改建议），无任何额外文字。

【示例 - 情况A（完美正确）】
太棒了！这句话说得超级自然～  
你的表达 "Thanks for letting me know, I'll check it out later." 完美无缺：  
- 语法完全正确  
- "Thanks for letting me know" 是很常见的礼貌回应  
- "I'll check it out later" 简洁又地道，母语者日常就是这么说的  

===SUGGESTIONS===
Thanks for letting me know, I'll check it out later.

【示例 - 情况B（有改进空间）】
你的句子基本意思清楚，但可以更自然流畅一些。  
排序依据：优先最地道 + 语气最友好，其次更简洁的版本。

**建议1（最推荐）** 🌟  
Thanks for the heads-up! I'll take a look when I get a chance.

**建议2** ✨  
Appreciate the info — I'll check it out later.

===SUGGESTIONS===
Thanks for the heads-up! I'll take a look when I get a chance.
Appreciate the info — I'll check it out later.`

const TRANSLATION_PROMPT = `You are a professional English to Chinese translator. Your task is to translate chat messages from English to Chinese.

Requirements:
- Translate naturally and conversationally
- Keep the original meaning and tone
- Do not add any explanations or comments
- Output ONLY the translation, nothing else
- Translate English text to Chinese (简体中文)`;


const isAllASCII = (str: string) => /^[\x00-\x7F]*$/.test(str);

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
      { role: 'system', content: isAllASCII(options.input) ? SYSTEM_PROMPT2 : SYSTEM_PROMPT}
    ];

    // Add context messages if available
    if (options.contextMessages && options.contextMessages.length > 0) {
      const contextText = options.contextMessages
        .filter(msg => msg.text && msg.text.trim() !== '')  // Filter out empty messages
        .map(msg => `${msg.isMe ? '我' : (msg.senderName || msg.senderId)}: ${msg.text || ''}`)
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