/**
 * ChatDetailScreen - 聊天详情页面
 * 
 * 功能：
 * - 显示消息列表
 * - 发送消息
 * - 消息翻译
 * - 消息操作（复制、翻译）
 */

import React, { useState, useRef, useEffect } from 'react';
import { Observable } from 'rxjs';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Clipboard,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Q } from '@nozbe/watermelondb';
import { Conversation, Group, Friend, GroupMember } from '../../database/models';
import { getDatabase } from '../../database';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Model } from '@nozbe/watermelondb';
import { useWebSocket } from '../../contexts/WebSocketContext';
import { generateDirectConversationId, generateGroupConversationId } from '../../utils/conversationId';
import { useAuth } from '../../contexts/AuthContext';
import TranslationAssistantModal from '../../components/TranslationAssistantModal';
import MessageTranslateModal from './components/MessageTranslateModal';
import MessageActionMenu from './components/MessageActionMenu';
import ChatMessagesList from './components/ChatMessagesList';
import ChatInput from './components/ChatInput';
import { useChatSync } from './hooks/useChatSync';
import { useChatMessages } from './hooks/useChatMessages';
import { useMessageSender } from './hooks/useMessageSender';
import { SelectedMessage, MenuAction } from './types';
import logger from '../../utils/logger';

const ChatDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const parentNavigation = useNavigation();
  const tabNavigation = parentNavigation.getParent();
  const { sendMessage, joinChat, leaveChat, markRead, onMessage, onMessageSent } = useWebSocket();
  const { user } = useAuth();

  // 获取数据库实例
  const database = getDatabase() || useDatabase();
  const chatId = route.params.chatId;
  const chatName = route.params.chatName;
  const chatType = route.params.chatType || 'direct';

  // 生成 conversationId
  const conversationId = React.useMemo(() => {
    if (chatType === 'group') {
      return generateGroupConversationId(chatId);
    }
    const currentUserId = user?.id || '';
    return generateDirectConversationId(currentUserId, chatId);
  }, [chatId, chatType, user?.id]);

  // 状态管理
  const [inputText, setInputText] = useState('');
  const [showTranslationAssistant, setShowTranslationAssistant] = useState(false);
  const [showMessageTranslate, setShowMessageTranslate] = useState(false);
  const [showMessageActionMenu, setShowMessageActionMenu] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<SelectedMessage | null>(null);
  const [messageBubbleRef, setMessageBubbleRef] = useState<View | null>(null);
  const [anchorPosition, setAnchorPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [currentChatName, setCurrentChatName] = useState(chatName); // State for current chat name

  // 自定义 Hooks
  const {
    syncGroupMembers,
    syncUserInfo,
    syncConversationInfo,
    syncMessagesFromServer,
  } = useChatSync({ database, conversationId, chatId, chatType });

  const {
    messages,
    setMessages,
    loading,
    sendingTimeouts,
  } = useChatMessages({
    database,
    conversationId,
    chatId,
    chatType,
    user,
    onMessage,
    onMessageSent,
    joinChat,
    leaveChat,
    syncMessagesFromServer,
    syncConversationInfo,
    syncUserInfo,
  });

  const {
    handleSendMessage,
    handleRetryMessage,
    handleAcceptTranslation,
  } = useMessageSender({
    database,
    conversationId,
    chatId,
    chatType,
    user,
    inputText,
    setInputText,
    setMessages,
    sendMessage: (convId, text, type, msgId, cType) => {
      sendMessage(convId, text, type, msgId, cType as 'direct' | 'group');
    },
    sendingTimeouts,
  });

  // 键盘动画
  const insets = useSafeAreaInsets();
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();

  const translateY = useDerivedValue(() => {
    return withTiming(keyboardHeight.value, { duration: 0 });
  });

  const animatedListStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // 设置当前聊天 ID（用于消息服务判断是否需要增加未读数）
  useEffect(() => {
    // 进入聊天页面时，调用同步接口获取未读消息并确认
    const syncAndAck = async () => {
      logger.info('ChatDetailScreen', 'Entering chat, syncing messages...');
      await syncMessagesFromServer();
    };
    
    syncAndAck();

    return () => {
      logger.info('ChatDetailScreen', 'Leaving chat');
    };
  }, [chatId, conversationId]);

  // 订阅群组名称变更
  useEffect(() => {
    if (!database || chatType !== 'group') return;

    let subscription: any;
    
    const setupSubscription = async () => {
      logger.debug('ChatDetailScreen', 'Setting up group name subscription for:', chatId);
      
      // Fetch initial name
      try {
        const groupRecords = await database.collections
          .get<Group>('groups')
          .query(Q.where('group_id', Q.eq(chatId)))
          .fetch();
        
        logger.debug('ChatDetailScreen', 'Initial group records found:', groupRecords.length);
        
        if (groupRecords.length > 0) {
          logger.debug('ChatDetailScreen', 'Current name:', currentChatName, 'Group name:', groupRecords[0].name);
          if (groupRecords[0].name !== currentChatName) {
            const newGroupName = groupRecords[0].name;
            logger.info('ChatDetailScreen', 'Updating group name from subscription:', newGroupName);
            setCurrentChatName(newGroupName);
            
            // Update navigation options directly to ensure header updates
            navigation.setOptions({
              headerTitle: newGroupName,
            });
          }
        }
      } catch (error) {
        logger.error('ChatDetailScreen', 'Error fetching initial group name:', error);
      }

      // Subscribe to changes
      const observable = database.collections
        .get('groups')
        .query(Q.where('group_id', Q.eq(chatId)))
        .observe();

      subscription = observable.subscribe((groups: Model[]) => {
        const typedGroups = groups as Group[];
        logger.debug('ChatDetailScreen', 'Group subscription triggered, groups found:', typedGroups.length);
        if (typedGroups.length > 0 && typedGroups[0].name !== currentChatName) {
          const newGroupName = typedGroups[0].name;
          logger.info('ChatDetailScreen', 'Group name changed via subscription:', newGroupName);
          setCurrentChatName(newGroupName);
          
          // Update navigation options directly to ensure header updates
          navigation.setOptions({
            headerTitle: newGroupName,
          });
        }
      });
    };

    setupSubscription();

    return () => {
      if (subscription) {
        logger.debug('ChatDetailScreen', 'Unsubscribing from group name changes');
        subscription.unsubscribe();
      }
    };
  }, [database, chatId, chatType, currentChatName, navigation]);

  // 设置导航栏
  useEffect(() => {
    if (tabNavigation) {
      tabNavigation.setOptions({
        tabBarStyle: { display: 'none' },
      });
    }

    navigation.setOptions({
      headerShown: true,
      headerStyle: {
        backgroundColor: '#f8f8f8',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
      },
      headerTitle: currentChatName, // Use currentChatName instead of initial chatName
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: 'bold',
      },
      headerLeft: () => (
        <TouchableOpacity
          style={{ paddingLeft: 16 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ fontSize: 24, fontWeight: 'normal' }}>‹</Text>
        </TouchableOpacity>
      ),
      headerRight: () => {
        if (chatType === 'group') {
          return (
            <TouchableOpacity
              style={{ paddingRight: 16 }}
              onPress={() => {
                // Using navigate with proper parameters for GroupDetail
                (navigation as any).navigate('GroupDetail', {
                  groupId: chatId,
                  groupName: currentChatName,
                });
              }}
            >
              <Text style={{ fontSize: 20 }}>⋯</Text>
            </TouchableOpacity>
          );
        }
        return null;
      },
    });

    return () => {
      if (tabNavigation) {
        tabNavigation.setOptions({
          tabBarStyle: {} // 恢复 tab bar
        });
      }
    };
  }, [navigation, currentChatName, tabNavigation]);

  // 当屏幕获得焦点时，刷新群组名称并标记消息为已读
  useFocusEffect(
    React.useCallback(() => {
      if (chatType === 'group' && database) {
        logger.debug('ChatDetailScreen', 'Focus effect triggered, checking for group name update');
        const fetchGroupName = async () => {
          try {
            const groupRecords = await database.collections
              .get<Group>('groups')
              .query(Q.where('group_id', Q.eq(chatId)))
              .fetch();

            logger.debug('ChatDetailScreen', 'Fetched groups on focus:', groupRecords.length);

            if (groupRecords.length > 0) {
              logger.debug('ChatDetailScreen', 'Comparing names - Current:', currentChatName, 'DB:', groupRecords[0].name);
              if (groupRecords[0].name !== currentChatName) {
                const newGroupName = groupRecords[0].name;
                logger.info('ChatDetailScreen', 'Updating group name on focus:', newGroupName);
                setCurrentChatName(newGroupName);

                // Update navigation options directly to ensure header updates
                navigation.setOptions({
                  headerTitle: newGroupName,
                });
              }
            }
          } catch (error) {
            logger.error('ChatDetailScreen', 'Error fetching group name on focus:', error);
          }
        };

        fetchGroupName();
      }

      // 标记消息为已读：清除本地未读计数，并通知后端
      logger.info('ChatDetailScreen', 'Screen focused, marking messages as read');
      markRead(conversationId);

      // 清除本地 conversation 的未读计数
      database?.write(async () => {
        const conversations = await database.collections
          .get<Conversation>('conversations')
          .query(Q.where('conversation_id', Q.eq(conversationId)))
          .fetch();

        if (conversations.length > 0) {
          await conversations[0].update((c: Conversation) => {
            c.unreadCount = 0;
            c.updatedAt = Date.now();
          });
          logger.info('ChatDetailScreen', 'Local unread count cleared');
        }
      }).catch(err => {
        logger.error('ChatDetailScreen', 'Error clearing unread count:', err);
      });
    }, [database, chatId, chatType, currentChatName, navigation, conversationId, markRead])
  );

  // 处理消息长按
  const handleMessageLongPress = (message: SelectedMessage, ref: View | null) => {
    setSelectedMessage(message);
    setMessageBubbleRef(ref);

    // 测量消息气泡的位置
    if (ref) {
      ref.measureInWindow((x, y, width, height) => {
        setAnchorPosition({ x, y, width, height });
      });
    }

    setShowMessageActionMenu(true);
  };

  // 处理菜单操作
  const handleMenuAction = (action: MenuAction) => {
    if (!selectedMessage) return;

    if (action === 'translate') {
      // 翻译操作：先关闭菜单，但保留 selectedMessage 供 MessageTranslateModal 使用
      setShowMessageActionMenu(false);
      // 延迟设置翻译模态框显示，确保菜单关闭后再显示
      setTimeout(() => {
        setShowMessageTranslate(true);
      }, 0);
    } else if (action === 'copy') {
      Clipboard.setString(selectedMessage.text);
      Alert.alert('已复制', '消息已复制到剪贴板');
      setShowMessageActionMenu(false);
      setSelectedMessage(null);
    }
  };

  // 关闭翻译助手
  const handleCloseTranslationAssistant = () => {
    setShowTranslationAssistant(false);
  };

  // 处理长按发送按钮（翻译）
  const handleLongPress = () => {
    if (inputText.trim() === '') return;
    setShowTranslationAssistant(true);
  };

  // 键盘打开时滚动到最新消息
  const handleKeyboardFocus = () => {
    setTimeout(() => {
      // 这里可以通过 ref 调用 ChatMessagesList 的滚动方法
      // 简化处理，暂不实现
    }, 200);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* 消息列表 */}
      <Animated.View style={[styles.messagesWrapper, animatedListStyle]}>
        <ChatMessagesList
          messages={messages}
          onMessageLongPress={handleMessageLongPress}
          onMessageRetry={handleRetryMessage}
        />
      </Animated.View>

      {/* 输入区 */}
      <KeyboardStickyView
        offset={{
          closed: 0,
          opened: 0,
        }}
      >
        <ChatInput
          inputText={inputText}
          onTextChange={setInputText}
          onSend={handleSendMessage}
          onLongPress={handleLongPress}
          onKeyboardFocus={handleKeyboardFocus}
        />
      </KeyboardStickyView>

      {/* 翻译助手模态框 */}
      {showTranslationAssistant && (
        <TranslationAssistantModal
          visible={showTranslationAssistant}
          onClose={handleCloseTranslationAssistant}
          userInput={inputText}
          conversationId={conversationId}
          onAccept={(t) => {handleAcceptTranslation(t); setInputText('');}}
        />
      )}

      {/* 消息操作菜单 */}
      {showMessageActionMenu && selectedMessage && (
        <MessageActionMenu
          visible={showMessageActionMenu}
          messageId={selectedMessage.id}
          messageText={selectedMessage.text}
          onPress={handleMenuAction}
          onClose={() => {
            // 只在菜单被取消时关闭，不立即清空 selectedMessage
            // selectedMessage 在翻译模态框关闭时清空
            setShowMessageActionMenu(false);
          }}
          anchorRef={messageBubbleRef ? { current: messageBubbleRef } : undefined}
          anchorPosition={anchorPosition || undefined}
        />
      )}

      {/* 消息翻译模态框 */}
      {showMessageTranslate && selectedMessage && (
        <MessageTranslateModal
          visible={showMessageTranslate}
          messageId={selectedMessage.msgId}
          conversationId={conversationId}
          originalText={selectedMessage.text}
          onClose={() => {
            setShowMessageTranslate(false);
            setSelectedMessage(null);
            setMessageBubbleRef(null);
            setAnchorPosition(null);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  messagesWrapper: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatDetailScreen;
