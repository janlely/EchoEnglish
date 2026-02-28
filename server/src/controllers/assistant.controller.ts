import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import openRouterService from '../services/openrouter.service';
import messageService from '../services/message.service';
import logger from '../utils/logger';

interface AnalyzeRequest {
  input: string;
  conversationId?: string;
  // contextMessages will now be retrieved internally by the service
}

class AssistantController {
  /**
   * Analyze user's input and provide English suggestions
   * Uses Server-Sent Events (SSE) for streaming response
   */
  async analyze(req: AuthRequest, res: Response, next: NextFunction) {
    const userId = req.user!.id;
    const { input, conversationId }: AnalyzeRequest = req.body;

    // Validate inputs early before setting SSE headers
    if (!input || input.trim() === '') {
      res.status(400).json({
        success: false,
        error: 'Input is required',
      });
      return;
    }

    if (!conversationId) {
      res.status(400).json({
        success: false,
        error: 'Conversation ID is required',
      });
      return;
    }

    try {
      logger.info(`[AssistantController] Analyze request from user ${userId}, conversation ${conversationId}: "${input.substring(0, 50)}..."`);

      // Set headers for SSE - DO THIS ONLY AFTER VALIDATION PASSES
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      // Add transfer-encoding header for chunked response
      res.setHeader('Transfer-Encoding', 'chunked');

      // Flush headers immediately
      if (res.flushHeaders) {
        res.flushHeaders();
      }

      // Send start event immediately and flush
      res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);
      
      // Force flush the data
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }

      // Retrieve context messages from the conversation
      const contextMessages = await messageService.getRecentMessagesForContext(userId, conversationId);

      // Stream from OpenRouter
      let fullContent = '';
      let suggestions: Array<{ text: string; highlight: string }> = [];

      // Flag to track if response has been ended to prevent double-ending
      let responseEnded = false;
      
      const endResponse = () => {
        if (!responseEnded) {
          responseEnded = true;
          res.end();
        }
      };

      // Call the OpenRouter service to stream analyze
      // The service will call the callbacks as it receives data from OpenRouter
      await openRouterService.streamAnalyze(
        {
          input,
          contextMessages
        },
        {
          onStart: () => {
            logger.info('[AssistantController] Stream started');
          },
          onText: (text) => {
            fullContent += text;

            // Immediately send text chunk to client as we receive it
            res.write(`data: ${JSON.stringify({
              type: 'text',
              content: text
            })}\n\n`);
            
            // Force flush
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
          },
          onSuggestion: (text, highlight) => {
            // Check if we already have this suggestion
            if (!suggestions.find(s => s.text === text)) {
              suggestions.push({
                text: text,
                highlight: highlight
              });
              // Immediately send suggestion to client
              res.write(`data: ${JSON.stringify({
                type: 'suggestion',
                text: text,
                highlight: highlight
              })}\n\n`);
              
              // Force flush
              if (typeof (res as any).flush === 'function') {
                (res as any).flush();
              }
            }
          },
          onError: (error) => {
            logger.error('[AssistantController] Stream error:', error);
            res.write(`data: ${JSON.stringify({
              type: 'error',
              error
            })}\n\n`);
            
            // Force flush
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
            endResponse();
          },
          onDone: () => {
            logger.info('[AssistantController] Stream completed');
            res.write(`data: ${JSON.stringify({
              type: 'done',
              fullContent,
              suggestions
            })}\n\n`);
            
            // Force flush
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
            endResponse();
          }
        }
      );
    } catch (error: any) {
      logger.error('[AssistantController] Analyze error:', error);
      // For errors that happen after SSE headers are set, send SSE error
      // For errors that happen before, we can't send SSE error
      try {
        // Check if headers have been sent (SSE started)
        if (!res.headersSent) {
          // Headers not sent yet, we can send regular error
          res.status(500).json({
            success: false,
            error: error.message || 'Unknown error'
          });
        } else {
          // Headers already sent, send SSE error
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: error.message || 'Unknown error'
          })}\n\n`);
          res.end();
        }
      } catch (writeError) {
        // If we can't write to response, log the error
        logger.error('[AssistantController] Failed to write error to response:', writeError);
      }
    }
  }

  /**
   * Analyze user's input and provide English suggestions via GET request
   * Uses Server-Sent Events (SSE) for streaming response
   */
  async analyzeGet(req: AuthRequest, res: Response, next: NextFunction) {
    const userId = req.user!.id;
    // For GET request, parameters come from query
    const { input, conversationId } = req.query as { input?: string; conversationId?: string };

    // Validate inputs early before setting SSE headers
    if (!input || input.trim() === '') {
      res.status(400).json({
        success: false,
        error: 'Input is required',
      });
      return;
    }

    if (!conversationId) {
      res.status(400).json({
        success: false,
        error: 'Conversation ID is required',
      });
      return;
    }

    try {
      logger.info(`[AssistantController] GET Analyze request from user ${userId}, conversation ${conversationId}: "${input.substring(0, 50)}..."`);

      // Set headers for SSE - DO THIS ONLY AFTER VALIDATION PASSES
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
      // Add transfer-encoding header for chunked response
      res.setHeader('Transfer-Encoding', 'chunked');

      // Flush headers immediately
      if (res.flushHeaders) {
        res.flushHeaders();
      }

      // Send start event immediately and flush
      res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);

      // Force flush the data
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }

      // Retrieve context messages from the conversation
      const contextMessages = await messageService.getRecentMessagesForContext(userId, conversationId);

      // Stream from OpenRouter
      let fullContent = '';
      let suggestions: Array<{ text: string; highlight: string }> = [];

      // Flag to track if response has been ended to prevent double-ending
      let responseEnded = false;

      const endResponse = () => {
        if (!responseEnded) {
          responseEnded = true;
          res.end();
        }
      };

      // Call the OpenRouter service to stream analyze
      // The service will call the callbacks as it receives data from OpenRouter
      await openRouterService.streamAnalyze(
        {
          input,
          contextMessages
        },
        {
          onStart: () => {
            logger.info('[AssistantController] Stream started');
          },
          onText: (text) => {
            fullContent += text;

            // Immediately send text chunk to client as we receive it
            res.write(`data: ${JSON.stringify({
              type: 'text',
              content: text
            })}\n\n`);

            // Force flush
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
          },
          onSuggestion: (text, highlight) => {
            // Check if we already have this suggestion
            if (!suggestions.find(s => s.text === text)) {
              suggestions.push({
                text: text,
                highlight: highlight
              });
              // Immediately send suggestion to client
              res.write(`data: ${JSON.stringify({
                type: 'suggestion',
                text: text,
                highlight: highlight
              })}\n\n`);

              // Force flush
              if (typeof (res as any).flush === 'function') {
                (res as any).flush();
              }
            }
          },
          onError: (error) => {
            logger.error('[AssistantController] Stream error:', error);
            res.write(`data: ${JSON.stringify({
              type: 'error',
              error
            })}\n\n`);

            // Force flush
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
            endResponse();
          },
          onDone: () => {
            logger.info('[AssistantController] Stream completed');
            res.write(`data: ${JSON.stringify({
              type: 'done',
              fullContent,
              suggestions
            })}\n\n`);

            // Force flush
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
            endResponse();
          }
        }
      );
    } catch (error: any) {
      logger.error('[AssistantController] GET Analyze error:', error);
      // For errors that happen after SSE headers are set, send SSE error
      // For errors that happen before, we can't send SSE error
      try {
        // Check if headers have been sent (SSE started)
        if (!res.headersSent) {
          // Headers not sent yet, we can send regular error
          res.status(500).json({
            success: false,
            error: error.message || 'Unknown error'
          });
        } else {
          // Headers already sent, send SSE error
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: error.message || 'Unknown error'
          })}\n\n`);
          res.end();
        }
      } catch (writeError) {
        // If we can't write to response, log the error
        logger.error('[AssistantController] Failed to write error to response:', writeError);
      }
    }
  }

  /**
   * Simple analyze without streaming (for testing)
   */
  async analyzeSimple(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { input, conversationId }: AnalyzeRequest = req.body;

      if (!input || input.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'Input is required',
        });
        return;
      }

      if (!conversationId) {
        res.status(400).json({
          success: false,
          error: 'Conversation ID is required',
        });
        return;
      }

      logger.info(`[AssistantController] Simple analyze request from user ${userId}, conversation ${conversationId}`);

      // Retrieve context messages from the conversation
      const contextMessages = await messageService.getRecentMessagesForContext(userId, conversationId);

      const result = await openRouterService.analyze({
        input,
        contextMessages
      });

      res.json({
        success: true,
        data: {
          result
        }
      });
    } catch (error: any) {
      logger.error('[AssistantController] Simple analyze error:', error);
      next(error);
    }
  }

  /**
   * Test endpoint for SSE functionality
   * Returns a simulated stream of content without calling OpenRouter
   */
  async testSSE(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { input, conversationId } = req.query as { input?: string; conversationId?: string };

      if (!input || input.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'Input is required',
        });
        return;
      }

      if (!conversationId) {
        res.status(400).json({
          success: false,
          error: 'Conversation ID is required',
        });
        return;
      }

      logger.info(`[AssistantController] SSE test request from user ${userId}, conversation ${conversationId}`);

      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Transfer-Encoding', 'chunked');

      if (res.flushHeaders) {
        res.flushHeaders();
      }

      // Send start event
      res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }

      // Send start event
      res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }

      // Small delay to ensure the start event is sent
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send initial content
      const initialContent = "Hello! I'm your English learning assistant. ";
      res.write(`data: ${JSON.stringify({ type: 'text', content: initialContent })}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // More content
      const moreContent = "Let me analyze your input and provide suggestions. ";
      res.write(`data: ${JSON.stringify({ type: 'text', content: moreContent })}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Even more content
      const additionalContent = "First, I'll check the grammar and vocabulary. ";
      res.write(`data: ${JSON.stringify({ type: 'text', content: additionalContent })}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Content with special marker
      const contentWithMarker = "Here's a better way to express yourself: ===SUGGESTIONS_JSON===";
      res.write(`data: ${JSON.stringify({ type: 'text', content: contentWithMarker })}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send suggestion
      const suggestionContent = "👉 {\"suggestion\": \"Consider using more advanced vocabulary\", \"highlight\": \"Vocabulary enhancement\"}";
      res.write(`data: ${JSON.stringify({ type: 'text', content: suggestionContent })}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send suggestion event
      res.write(`data: ${JSON.stringify({
        type: 'suggestion',
        text: 'Consider using more advanced vocabulary',
        highlight: 'Vocabulary enhancement'
      })}\n\n`);
      
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send done event
      res.write(`data: ${JSON.stringify({
        type: 'done',
        fullContent: "Hello! I'm your English learning assistant. Let me analyze your input and provide suggestions. First, I'll check the grammar and vocabulary. Here's a better way to express yourself: ===SUGGESTIONS_JSON===👉 {\"suggestion\": \"Consider using more advanced vocabulary\", \"highlight\": \"Vocabulary enhancement\"}",
        suggestions: [{
          text: 'Consider using more advanced vocabulary',
          highlight: 'Vocabulary enhancement'
        }]
      })}\n\n`);
      
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }

      // Ensure response ends properly
      res.end();
    } catch (error: any) {
      logger.error('[AssistantController] SSE test error:', error);
      try {
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: error.message || 'Unknown error'
          });
        } else {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: error.message || 'Unknown error'
          })}\n\n`);
          res.end();
        }
      } catch (writeError) {
        logger.error('[AssistantController] Failed to write error to response:', writeError);
      }
    }
  }
}

export default new AssistantController();