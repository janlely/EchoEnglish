import { API_CONFIG } from '../config/constants';
import { getAuthToken } from '../services/ApiService';
import { EventBus } from '../events/EventBus';

export interface ContextMessage {
  text: string;
  senderId: string;
  isMe: boolean;
  timestamp: number;
}

export interface AnalyzeRequest {
  input: string;
  conversationId: string;
  // contextMessages are now fetched by the backend
}

export interface Suggestion {
  text: string;
  highlight: string;
}

export interface SSEEvent {
  type: 'start' | 'text' | 'suggestion' | 'done' | 'error';
  content?: string;
  text?: string;
  highlight?: string;
  fullContent?: string;
  suggestions?: Suggestion[];
  error?: string;
}

/**
 * Stream analyze the user's input using WebSocket
 * Returns an EventSource-like interface with callbacks for compatibility
 */
export const streamAnalyze = (
  request: AnalyzeRequest,
  callbacks: {
    onStart?: () => void;
    onText?: (text: string) => void;
    onSuggestion?: (suggestion: Suggestion) => void;
    onDone?: (fullContent: string, suggestions: Suggestion[]) => void;
    onError?: (error: string) => void;
  }
): { close: () => void } => {
  const { WebSocketService } = require('../services/WebSocketService');

  let isClosed = false;
  let accumulatedText = ''; // Used for content before the marker
  let accumulatedSuggestions = ''; // Used for content after the marker
  let suggestions: Suggestion[] = [];
  let hasStarted = false;
  let isParsingSuggestions = false; // Flag to indicate if we're parsing suggestions
  let currentRequestId = ''; // Track the current request ID

  // Generate unique request ID
  const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  // Define response handler
  const handleResponseChunk = (data: any) => {
    if (isClosed || data.requestId !== requestId) return;

    try {
      switch (data.data.type) {
        case 'start':
          if (!hasStarted) {
            hasStarted = true;
            callbacks.onStart?.();
          }
          break;
        case 'text':
          if (data.data.content) {
            let fullContent = data.data.content;

            // Log the raw content for debugging
            console.log('[WebSocket] Raw text content received:', fullContent);

            // Accumulate content to handle fragmented markers
            if (!isParsingSuggestions) {
              // Still in main content mode
              // Add the new content to our accumulated buffer
              accumulatedText += fullContent;
              
              // Check if we have the marker in the accumulated content
              if (accumulatedText.includes('===SUGGESTIONS===')) {
                // Split content at the marker
                const parts = accumulatedText.split('===SUGGESTIONS===');

                // Log the split parts for debugging
                console.log('[WebSocket] Found suggestion marker, content before marker:', parts[0]);
                if (parts[1]) {
                  console.log('[WebSocket] Content after marker:', parts[1]);
                }

                // Send content before the marker to main content area
                if (parts[0]) {
                  console.log('[WebSocket] Sending content before marker to text callback:', parts[0]);
                  callbacks.onText?.(parts[0]);
                }

                // Switch to suggestions parsing mode
                isParsingSuggestions = true;

                // Process any suggestions that might be in the part after the marker
                if (parts[1]) {
                  console.log('[WebSocket] Processing content after marker for suggestions:', parts[1]);
                  // Store content after marker in the dedicated variable
                  accumulatedSuggestions += parts[1];
                  
                  // Split by lines and treat each line as a suggestion
                  const lines = parts[1].split('\n');
                  console.log('[WebSocket] Lines after marker:', lines);
                  
                  lines.forEach(line => {
                    // Trim whitespace
                    const trimmedLine = line.trim();
                    if (trimmedLine && trimmedLine !== '===SUGGESTIONS===') {
                      // Treat each non-empty line as a suggestion (but exclude the marker itself)
                      const suggestion = {
                        text: trimmedLine,
                        highlight: "" // No highlight needed
                      };

                      console.log('[WebSocket] Parsed suggestion:', suggestion);

                      // Avoid duplicates
                      if (!suggestions.find(s => s.text === suggestion.text)) {
                        suggestions.push(suggestion);
                        callbacks.onSuggestion?.(suggestion);
                      }
                    }
                  });
                }
              } else {
                // Regular content before marker - send to main content area
                console.log('[WebSocket] Sending regular content to text callback:', fullContent);
                callbacks.onText?.(fullContent);
              }
            } else {
              // In suggestions parsing mode - accumulate content after the marker
              // Since we're in a streaming protocol, we'll collect all content and parse at the end
              // Add content to the dedicated suggestions accumulator
              console.log('[WebSocket] In suggestions parsing mode, adding content to accumulatedSuggestions:', fullContent);
              accumulatedSuggestions += fullContent;
              
              console.log('[WebSocket] Current accumulatedSuggestions in suggestions mode:', accumulatedSuggestions);
              
              // Check if we have complete lines in accumulated suggestions content
              const lines = accumulatedSuggestions.split('\n');
              console.log('[WebSocket] Split accumulatedSuggestions into lines:', lines);
              // Process all but the last line (it might be incomplete)
              const completeLines = lines.slice(0, -1);
              const remainingContent = lines[lines.length - 1]; // Last potentially incomplete line
              
              console.log('[WebSocket] Complete lines to process:', completeLines);
              console.log('[WebSocket] Remaining content (incomplete line):', remainingContent);

              completeLines.forEach(line => {
                const trimmedLine = line.trim();
                if (trimmedLine && trimmedLine !== '===SUGGESTIONS===') {
                  // Treat each non-empty line as a suggestion (but exclude the marker itself)
                  const suggestion = {
                    text: trimmedLine,
                    highlight: "" // No highlight needed
                  };

                  console.log('[WebSocket] Parsed suggestion from complete line:', suggestion);

                  // Avoid duplicates
                  if (!suggestions.find(s => s.text === suggestion.text)) {
                    suggestions.push(suggestion);
                    callbacks.onSuggestion?.(suggestion);
                  }
                }
              });
              
              // Keep the incomplete line in accumulatedSuggestions for next round
              console.log('[WebSocket] Updating accumulatedSuggestions to remaining content:', remainingContent);
              accumulatedSuggestions = remainingContent;
            }
          }
          break;
        case 'suggestion':
          if (data.data.suggestion) {
            const suggestion = {
              text: data.data.suggestion.text,
              highlight: data.data.suggestion.highlight,
            };
            console.log('[WebSocket] Direct suggestion received:', suggestion);
            // Avoid duplicates
            if (!suggestions.find(s => s.text === suggestion.text)) {
              console.log('[WebSocket] Adding suggestion:', suggestion);
              suggestions.push(suggestion);
              callbacks.onSuggestion?.(suggestion);
            }
          }
          break;
        case 'done':
          // Process any remaining content in accumulatedSuggestions before finishing
          if (accumulatedSuggestions && isParsingSuggestions) {
            console.log('[WebSocket] Processing remaining content as suggestions:', accumulatedSuggestions);
            // Split by lines and treat each line as a suggestion
            const lines = accumulatedSuggestions.split('\n');
            
            lines.forEach(line => {
              const trimmedLine = line.trim();
              if (trimmedLine && trimmedLine !== '===SUGGESTIONS===') {
                // Treat each non-empty line as a suggestion (but exclude the marker itself)
                const suggestion = {
                  text: trimmedLine,
                  highlight: "" // No highlight needed
                };

                console.log('[WebSocket] Parsed final suggestion:', suggestion);

                // Avoid duplicates
                if (!suggestions.find(s => s.text === suggestion.text)) {
                  suggestions.push(suggestion);
                  callbacks.onSuggestion?.(suggestion);
                }
              }
            });
          }
          console.log('[WebSocket] Final accumulatedText:', accumulatedText);
          console.log('[WebSocket] Final accumulatedSuggestions:', accumulatedSuggestions);
          console.log('[WebSocket] Final suggestions array:', suggestions);
          console.log('[WebSocket] Calling onDone with accumulatedText and suggestions');
          callbacks.onDone?.(accumulatedText, suggestions);
          break;
        case 'error':
          callbacks.onError?.(data.data.error || 'Unknown error');
          break;
      }
    } catch (parseError) {
      console.error('Error parsing WebSocket assistant response:', parseError);
      callbacks.onError?.('Error parsing server response');
    }
  };

  // Register the event handler via EventBus
  const unsubscribe = EventBus.on('ws:assistant_chunk', handleResponseChunk);

  // Send the assistant request
  setTimeout(() => {
    if (!isClosed) {
      WebSocketService.sendAssistantRequest(requestId, request.input, request.conversationId);
    }
  }, 0);

  return {
    close: () => {
      isClosed = true;
      // Remove the event listener when closing
      unsubscribe();
    },
  };
};

/**
 * Simple analyze without streaming (for testing)
 */
export const analyzeSimple = async (request: AnalyzeRequest): Promise<string> => {
  const token = await getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_CONFIG.BASE_URL}/api/assistant/analyze-simple`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { data?: { result?: string } };
  return data.data?.result || '';
};