import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Clipboard,
  Alert,
} from 'react-native';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Message } from '../../../database/models';
import { Q } from '@nozbe/watermelondb';
import { useWebSocket } from '../../../contexts/WebSocketContext';
import { EventBus } from '../../../events/EventBus';
import logger from '../../../utils/logger';

interface MessageTranslateModalProps {
  visible: boolean;
  messageId: string;
  conversationId: string;
  originalText: string;
  onClose: () => void;
}

interface TranslationResponse {
  type: 'start' | 'chunk' | 'done' | 'error';
  content?: string;
  translation?: string;
  messageId?: string;
  error?: string;
}

const MessageTranslateModal: React.FC<MessageTranslateModalProps> = ({
  visible,
  messageId,
  conversationId,
  originalText,
  onClose,
}) => {
  const database = useDatabase();
  const { sendTranslateRequest } = useWebSocket();
  const [isLoading, setIsLoading] = useState(true);
  const [translation, setTranslation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  // 使用 ref 存储 unsubscribe 函数，确保可以在清理时调用
  const unsubscribeRef = React.useRef<(() => void) | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理函数
  const cleanup = React.useCallback(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      resetState();
      startTranslation();
    } else {
      // modal 关闭时清理
      cleanup();
    }

    // 组件卸载或 visible 变化时清理
    return () => {
      cleanup();
    };
  }, [visible, messageId, cleanup]);

  const resetState = () => {
    setIsLoading(true);
    setTranslation('');
    setError(null);
    setIsCached(false);
  };

  const startTranslation = async () => {
    // 先清理之前的监听器
    cleanup();

    const requestId = `translate_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    logger.debug('MessageTranslateModal', '========== START TRANSLATION ==========');
    logger.debug('MessageTranslateModal', 'Message ID:', messageId);
    logger.debug('MessageTranslateModal', 'Conversation ID:', conversationId);
    logger.debug('MessageTranslateModal', 'Request ID:', requestId);

    // First, check local database for cached translation
    logger.debug('MessageTranslateModal', 'Checking local database for cached translation...');
    const cachedTranslation = await getCachedTranslationFromDatabase(messageId);
    if (cachedTranslation) {
      logger.debug('MessageTranslateModal', '✅ Found cached translation in database:', cachedTranslation.substring(0, 50));
      setIsCached(true);
      setTranslation(cachedTranslation);
      setIsLoading(false);
      return;
    }

    // No cache, request translation from backend
    logger.debug('MessageTranslateModal', '❌ No cache found, requesting from backend...');
    logger.debug('MessageTranslateModal', 'Calling sendTranslateRequest WebSocket event...');

    // Set timeout to detect no response
    timeoutRef.current = setTimeout(() => {
      logger.error('MessageTranslateModal', '⏰ Translation timeout - no response from backend');
      setError('翻译超时，请检查网络连接');
      setIsLoading(false);
    }, 30000); // 30 秒超时

    // Listen for translation response via EventBus
    unsubscribeRef.current = EventBus.on('ws:translate_response', (response: any) => {
      // Clear timeout on first response
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // 响应格式：{ type: 'translate_message_response', requestId: '...', data: { type: 'start', ... } }
      // 使用 JSON 序列化确保能正确访问嵌套对象
      const responseObj = JSON.parse(JSON.stringify(response));
      const responseData = responseObj?.data;

      console.log('[MessageTranslateModal] responseObj:', responseObj);
      console.log('[MessageTranslateModal] responseData:', responseData);
      console.log('[MessageTranslateModal] responseData.type:', responseData?.type);

      if (!responseData) {
        logger.warn('MessageTranslateModal', 'No data in response');
        return;
      }

      switch (responseData.type) {
        case 'start':
          setIsLoading(false);
          break;

        case 'chunk':
          setTranslation(prev => prev + (responseData.content || ''));
          break;

        case 'done':
          const finalTranslation = responseData.translation || '';
          setTranslation(finalTranslation);
          setIsLoading(false);
          saveTranslationToDatabase(messageId, finalTranslation);
          // Clean up listener after done
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
          break;

        case 'error':
          setError(responseData.error || 'Translation failed');
          setIsLoading(false);
          // Clean up listener after error
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
          break;
      }
    });

    logger.debug('MessageTranslateModal', 'WebSocket listener registered via EventBus');

    // Send translation request
    sendTranslateRequest({
      id: requestId,
      messageId,
      conversationId,
    });

    logger.debug('MessageTranslateModal', 'Translation request sent');
  };

  /**
   * Get cached translation from local database
   */
  const getCachedTranslationFromDatabase = async (msgId: string): Promise<string | null> => {
    if (!database) return null;

    try {
      const messages = await database.collections
        .get<Message>('messages')
        .query(Q.where('msg_id', Q.eq(msgId)))
        .fetch();

      if (messages.length > 0 && messages[0].translation) {
        logger.debug('MessageTranslateModal', 'Found cached translation:', messages[0].translation.substring(0, 50));
        return messages[0].translation;
      }
      return null;
    } catch (error: any) {
      logger.error('MessageTranslateModal', 'Get cached translation error:', error.message);
      return null;
    }
  };

  /**
   * Save translation to local database
   */
  const saveTranslationToDatabase = async (msgId: string, translationText: string) => {
    if (!database) return;

    try {
      const messages = await database.collections
        .get<Message>('messages')
        .query(Q.where('msg_id', Q.eq(msgId)))
        .fetch();

      if (messages.length > 0) {
        await database.write(async () => {
          await messages[0].update((m: Message) => {
            m.translation = translationText;
          });
        });
        logger.debug('MessageTranslateModal', 'Translation saved to database for:', msgId);
      } else {
        logger.warn('MessageTranslateModal', 'Message not found for translation save:', msgId);
      }
    } catch (error: any) {
      logger.error('MessageTranslateModal', 'Save translation error:', error.message);
    }
  };

  const handleCopy = () => {
    if (translation) {
      Clipboard.setString(translation);
      Alert.alert('已复制', '翻译结果已复制到剪贴板');
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🔤 英译中</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Original Text */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>原文（英语）：</Text>
            <View style={styles.originalTextContainer}>
              <Text style={styles.originalText}>{originalText}</Text>
            </View>
          </View>

          {/* Translation */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>译文（中文）：</Text>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>正在翻译...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>翻译失败：{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={startTranslation}
                >
                  <Text style={styles.retryButtonText}>重试</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.translationContainer}>
                <ScrollView
                  style={styles.translationScroll}
                  showsVerticalScrollIndicator={true}
                >
                  <Text style={styles.translationText}>{translation}</Text>
                </ScrollView>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.closeButtonLarge}
              onPress={handleClose}
            >
              <Text style={styles.closeButtonLargeText}>关闭</Text>
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
    maxHeight: '80%',
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
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  originalTextContainer: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
  },
  originalText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
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
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  translationContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
  },
  cachedBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  cachedText: {
    color: '#1976d2',
    fontSize: 12,
  },
  translationScroll: {
    maxHeight: 200,
  },
  translationText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  copyButton: {
    marginTop: 10,
    alignSelf: 'flex-end',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  copyButtonText: {
    color: '#333',
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  closeButtonLarge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonLargeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default MessageTranslateModal;
