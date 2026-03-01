import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { Suggestion, streamAnalyze, ContextMessage } from '../api/assistant';
import logger from '../utils/logger';

interface TranslationAssistantModalProps {
  visible: boolean;
  onClose: () => void;
  userInput: string;
  conversationId: string;
  onAccept: (selectedText: string) => void;
}

const TranslationAssistantModal: React.FC<TranslationAssistantModalProps> = ({
  visible,
  onClose,
  userInput,
  conversationId,
  onAccept,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [mainContent, setMainContent] = useState('');  // Main content to display before the special marker
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);  // Suggestions parsed after the marker
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [expandedContext, setExpandedContext] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      resetState();
      startAnalysis();
    }
  }, [visible]);
  
  // Auto-scroll to bottom when mainContent changes
  useEffect(() => {
    if (scrollViewRef.current) {
      // Use a slight delay to ensure the content has been rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 10);
    }
  }, [mainContent]);

  const resetState = () => {
    setIsLoading(true);
    setMainContent('');
    setSuggestions([]);
    setSelectedSuggestion(null);
    setStreamError(null);
  };

  const startAnalysis = () => {
    const request = {
      input: userInput,
      conversationId,
      // contextMessages are now fetched by the backend
    };

    const streamHandle = streamAnalyze(request, {
      onStart: () => {
        logger.debug('TranslationAssistantModal', 'Stream started');
      },
      onText: (text: string) => {
        setMainContent(prev => prev + text);
        // Stop loading once we receive the first text chunk
        if (isLoading) {
          setIsLoading(false);
        }
      },
      onSuggestion: (suggestion: { text: string; highlight: string }) => {
        setSuggestions(prev => {
          // Avoid duplicates
          if (!prev.some(s => s.text === suggestion.text)) {
            return [...prev, suggestion];
          }
          return prev;
        });
      },
      onDone: (fullContent: string, allSuggestions: { text: string; highlight: string }[]) => {
        logger.debug('TranslationAssistantModal', 'Stream completed');
        // Ensure loading is stopped when stream is done
        setIsLoading(false);
      },
      onError: (error: string) => {
        logger.error('TranslationAssistantModal', 'Stream error:', error);
        setStreamError(error);
        setIsLoading(false);
      },
    });

    // Cleanup function to close stream when modal closes
    return () => {
      streamHandle.close();
    };
  };

  const handleSuggestionSelect = (suggestion: string) => {
    logger.debug('TranslationAssistantModal', 'Selecting suggestion:', suggestion);
    setSelectedSuggestion(suggestion);
  };

  const handleAccept = () => {
    logger.info('TranslationAssistantModal', 'Accepting suggestion:', selectedSuggestion);
    if (selectedSuggestion) {
      onAccept(selectedSuggestion);
      onClose();
    } else {
      Alert.alert('提示', '请选择一个建议');
    }
  };

  const toggleContextExpand = () => {
    setExpandedContext(!expandedContext);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🔮 AI 英语助手</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>


          {/* User Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✏️ 我的输入:</Text>
            <View style={styles.userInputContainer}>
              <Text style={styles.userInputText}>{userInput}</Text>
            </View>
          </View>

          {/* AI Analysis */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🤖 AI 分析</Text>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>AI 正在分析您的输入...</Text>
              </View>
            ) : streamError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>分析出错: {streamError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={startAnalysis}
                >
                  <Text style={styles.retryButtonText}>重试</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView 
                style={styles.analysisContainer}
                ref={scrollViewRef}
                onContentSizeChange={() => {
                  // Auto-scroll to bottom when content changes
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 10);
                }}
                showsVerticalScrollIndicator={true}
              >
                <View style={{ paddingBottom: 10 }}>
                  <Markdown style={markdownStyles}>{mainContent}</Markdown>
                </View>
              </ScrollView>
            )}
          </View>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💡 建议表达</Text>
              <ScrollView 
                style={styles.suggestionsScrollView}
                showsVerticalScrollIndicator={true}
              >
                <View style={[styles.suggestionsContainer, { padding: 10 }]}>
                  {suggestions.map((suggestion, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.suggestionItem,
                        selectedSuggestion === suggestion.text && styles.selectedSuggestion
                      ]}
                      onPress={() => {
                        logger.debug('TranslationAssistantModal', 'Suggestion item pressed:', suggestion.text, 'at index:', index);
                        handleSuggestionSelect(suggestion.text);
                      }}
                    >
                      <Text style={styles.suggestionText}>👉 {suggestion.text}</Text>
                      {suggestion.highlight ? (
                        <Text style={styles.suggestionHighlight}>{suggestion.highlight}</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}


          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.acceptButton,
                !selectedSuggestion && styles.disabledButton
              ]}
              onPress={handleAccept}
              disabled={!selectedSuggestion}
            >
              <Text style={styles.acceptButtonText}>发送选中内容</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#999',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  contextHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
  },
  contextHeaderText: {
    fontSize: 14,
    color: '#666',
  },
  expandText: {
    fontSize: 12,
    color: '#007AFF',
  },
  contextContent: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
  },
  contextScroll: {
    maxHeight: 100,
  },
  contextMessage: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  contextSender: {
    fontWeight: 'bold',
    minWidth: 40,
    color: '#666',
  },
  contextText: {
    flex: 1,
    color: '#333',
  },
  noContextText: {
    color: '#999',
    fontStyle: 'italic',
  },
  userInputContainer: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
  },
  userInputText: {
    fontSize: 16,
    color: '#333',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#f44336',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  errorText: {
    color: '#f44336',
    marginBottom: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  analysisContainer: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
  },
  analysisText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  suggestionsContainer: {
    gap: 8,
  },
  suggestionItem: {
    backgroundColor: '#f0f8ff',
    borderWidth: 1,
    borderColor: '#cce5ff',
    borderRadius: 8,
    padding: 12,
  },
  selectedSuggestion: {
    backgroundColor: '#e6f7ff',
    borderWidth: 2,
    borderColor: '#1890ff',
  },
  suggestionText: {
    fontSize: 14,
    color: '#000',
    marginBottom: 4,
  },
  suggestionHighlight: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  selectedContainer: {
    backgroundColor: '#e6f7ff',
    borderWidth: 1,
    borderColor: '#91d5ff',
    borderRadius: 8,
    padding: 10,
  },
  selectedText: {
    fontSize: 14,
    color: '#1890ff',
  },
  suggestionsScrollView: {
    maxHeight: 150, // 固定 ScrollView 高度
    minHeight: 50,  // 最小高度
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
});

// Markdown styles for react-native-markdown-display
const markdownStyles = {
  // General text styles
  body: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  // Heading styles
  heading1: {
    fontSize: 24,
    fontWeight: 'bold' as 'bold',
    marginTop: 10,
    marginBottom: 10,
    color: '#333',
  },
  heading2: {
    fontSize: 20,
    fontWeight: 'bold' as 'bold',
    marginTop: 8,
    marginBottom: 8,
    color: '#333',
  },
  heading3: {
    fontSize: 18,
    fontWeight: 'bold' as 'bold',
    marginTop: 6,
    marginBottom: 6,
    color: '#333',
  },
  // Paragraph styles
  paragraph: {
    marginTop: 5,
    marginBottom: 5,
  },
  // Text formatting
  strong: {
    fontWeight: 'bold' as 'bold',
  },
  em: {
    fontStyle: 'italic' as 'italic',
  },
  // List styles
  bullet_list: {
    marginTop: 5,
    marginBottom: 5,
  },
  ordered_list: {
    marginTop: 5,
    marginBottom: 5,
  },
  list_item: {
    flexDirection: 'row' as 'row',
    marginLeft: 15,
    marginBottom: 5,
  },
  list_item_bullet: {
    marginLeft: 10,
    marginRight: 5,
    marginTop: 5,
  },
  list_item_text: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  // Code styles
  code_inline: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontFamily: 'Courier New' as 'Courier New',
    fontSize: 12,
  },
  fence: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontFamily: 'Courier New' as 'Courier New',
    fontSize: 12,
  },
  // Link styles
  link: {
    color: '#007AFF',
    textDecorationLine: 'underline' as 'underline',
  },
  // Blockquote styles
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: '#ddd',
    paddingLeft: 10,
    marginLeft: 0,
    color: '#666',
  },
};

export default TranslationAssistantModal;