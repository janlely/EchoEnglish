/**
 * ChatDetailScreen - 聊天详情页面
 *
 * 功能：
 * - 显示消息列表
 * - 发送消息
 * - 消息翻译
 * - 消息操作（复制、翻译、删除）
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
import { Conversation, Group, Friend, GroupMember, Message } from '../../database/models';
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
import GroupDissolvedNotice from './components/GroupDissolvedNotice';
import { useChatSync } from './hooks/useChatSync';
import { useChatMessages } from './hooks/useChatMessages';
import { useMessageSender } from './hooks/useMessageSender';
import { SelectedMessage, MenuAction } from './types';
import logger from '../../utils/logger';
import { isGroupDissolvedError } from '../../constants/errorCodes';
import { EventBus, WebSocketError } from '../../events/EventBus';
import { deleteMessage, ackMessages } from '../../api/conversations';

const ChatDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const parentNavigation = useNavigation();
  const tabNavigation = parentNavigation.getParent();
  const { sendMessage } = useWebSocket();
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
  const [isGroupDissolved, setIsGroupDissolved] = useState(false); // Group dissolution status

  // 自定义 Hooks
  const {
    syncGroupMembers,
    syncUserInfo,
    syncConversationInfo,
    syncMessagesFromServer,
    getLocalLastAckedSeq,
    updateLastAckedSeqToMax,
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
    sendMessage: (convId, text, type, msgId, cType, onSent) => {
      sendMessage(convId, text, type, msgId, cType as 'direct' | 'group', onSent);
    },
    sendingTimeouts,
    onGroupDissolved: () => {
      logger.info('ChatDetailScreen', 'Group dissolved callback triggered');
      setIsGroupDissolved(true);
    },
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

  // 监听发送错误事件（群解散等）- 通过 EventBus
  useEffect(() => {
    const unsubscribeError = EventBus.on('ws:send_error', (error) => {
      logger.info('ChatDetailScreen', 'Received send_error event:', error);

      // 使用错误码判断是否为群解散相关错误
      if (isGroupDissolvedError(error.code) && chatType === 'group') {
        logger.info('ChatDetailScreen', 'Group dissolved error received, updating local status');

        // 更新群组状态为已解散
        if (database) {
          database.write(async () => {
            const groupRecords = await database.collections
              .get<Group>('groups')
              .query(Q.where('group_id', Q.eq(chatId)))
              .fetch();

            if (groupRecords.length > 0) {
              await groupRecords[0].update((g: Group) => {
                g.status = 'dissolved';
                g.updatedAt = Date.now();
              });
              logger.info('ChatDetailScreen', 'Group status updated to dissolved');
            }
          }).catch(err => {
            logger.error('ChatDetailScreen', 'Error updating group status:', err);
          });
        }

        // 设置群已解散状态
        setIsGroupDissolved(true);
      }
    });

    return () => {
      unsubscribeError();
    };
  }, [chatType, chatId, database]);

  // 设置当前聊天 ID（用于消息服务判断是否需要增加未读数）
  useEffect(() => {
    // 进入聊天页面时，调用同步接口获取未读消息并确认
    const syncAndAck = async () => {
      logger.info('ChatDetailScreen', 'Entering chat, syncing messages...');
      await syncMessagesFromServer();

      // 异步更新 lastAckedSeq（不阻塞 UI）
      updateLastAckedSeqToMax().catch(err => {
        logger.error('ChatDetailScreen', 'Error updating lastAckedSeq on enter:', err);
      });
    };

    syncAndAck();

    return () => {
      logger.info('ChatDetailScreen', 'Leaving chat');
    };
  }, [chatId, conversationId, syncMessagesFromServer, updateLastAckedSeqToMax]);

  // 订阅群组名称变更
  useEffect(() => {
    if (!database || chatType !== 'group') return;

    let subscription: any;

    const setupSubscription = async () => {
      logger.debug('ChatDetailScreen', 'Setting up group name subscription for:', chatId);

      // Fetch initial name and dissolution status
      try {
        const groupRecords = await database.collections
          .get<Group>('groups')
          .query(Q.where('group_id', Q.eq(chatId)))
          .fetch();

        logger.debug('ChatDetailScreen', 'Initial group records found:', groupRecords.length);

        if (groupRecords.length > 0) {
          const group = groupRecords[0];
          // Check group name
          if (group.name !== currentChatName) {
            logger.info('ChatDetailScreen', 'Updating group name from subscription:', group.name);
            setCurrentChatName(group.name);
            navigation.setOptions({ headerTitle: group.name });
          }
          // Check dissolution status
          const dissolved = group.status === 'dissolved';
          if (dissolved !== isGroupDissolved) {
            logger.info('ChatDetailScreen', 'Group dissolution status:', dissolved);
            setIsGroupDissolved(dissolved);
          }
        }
      } catch (error) {
        logger.error('ChatDetailScreen', 'Error fetching initial group info:', error);
      }

      // Subscribe to changes
      const observable = database.collections
        .get('groups')
        .query(Q.where('group_id', Q.eq(chatId)))
        .observe();

      subscription = observable.subscribe((groups: Model[]) => {
        const typedGroups = groups as Group[];
        logger.debug('ChatDetailScreen', 'Group subscription triggered, groups found:', typedGroups.length);
        if (typedGroups.length > 0) {
          const group = typedGroups[0];
          // Check name change
          if (group.name !== currentChatName) {
            logger.info('ChatDetailScreen', 'Group name changed via subscription:', group.name);
            setCurrentChatName(group.name);
            navigation.setOptions({ headerTitle: group.name });
          }
          // Check dissolution status change
          const dissolved = group.status === 'dissolved';
          if (dissolved !== isGroupDissolved) {
            logger.info('ChatDetailScreen', 'Group dissolution status changed:', dissolved);
            setIsGroupDissolved(dissolved);
          }
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
  }, [database, chatId, chatType, currentChatName, isGroupDissolved, navigation]);

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
    }, [database, chatId, chatType, currentChatName, navigation, conversationId])
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

  // 处理删除消息
  const handleDeleteMessage = async () => {
    if (!selectedMessage || !database) return;

    try {
      const { id, msgId, seq } = selectedMessage;

      // 获取当前 lastAckedSeq
      const currentLastAckedSeq = await getLocalLastAckedSeq();
      logger.info('ChatDetailScreen', 'Delete message - seq:', seq, 'currentLastAckedSeq:', currentLastAckedSeq);

      // 确保待删除消息的 seq <= lastAckedSeq
      // 如果 seq > lastAckedSeq，需要先更新 lastAckedSeq
      if (seq !== undefined && (currentLastAckedSeq === undefined || seq > currentLastAckedSeq)) {
        logger.info('ChatDetailScreen', 'Message seq > lastAckedSeq, calling ack and updating lastAckedSeq');
        // 调用 ack 接口
        await ackMessages(conversationId, seq);
        // 更新 lastAckedSeq 到最大连续值
        await updateLastAckedSeqToMax();
      }

      // 调用后端删除接口
      await deleteMessage(id);

      // 从本地数据库删除消息
      await database.write(async () => {
        const messages = await database.collections
          .get<Message>('messages')
          .query(Q.where('id', Q.eq(id)))
          .fetch();

        if (messages.length > 0) {
          await messages[0].destroyPermanently();
        }
      });

      logger.info('ChatDetailScreen', 'Message deleted successfully');
      Alert.alert('成功', '消息已删除');
    } catch (error: any) {
      logger.error('ChatDetailScreen', 'Delete message error:', error);
      Alert.alert('删除失败', error.message || '无法删除消息');
    }
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
    } else if (action === 'delete') {
      setShowMessageActionMenu(false);
      // 显示确认对话框
      Alert.alert(
        '删除消息',
        '确定要删除这条消息吗？',
        [
          { text: '取消', style: 'cancel', onPress: () => setSelectedMessage(null) },
          {
            text: '删除',
            style: 'destructive',
            onPress: () => {
              handleDeleteMessage();
              setSelectedMessage(null);
            },
          },
        ]
      );
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
        {/* 群解散提示 */}
        {chatType === 'group' && isGroupDissolved && <GroupDissolvedNotice />}
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
          disabled={chatType === 'group' && isGroupDissolved}
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
          msgId={selectedMessage.msgId}
          seq={selectedMessage.seq}
          senderId={selectedMessage.senderId}
          currentUserId={user?.id}
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
