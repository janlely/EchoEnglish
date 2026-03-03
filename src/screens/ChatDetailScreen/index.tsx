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
import { getDatabase } from '../../database';
import { useNavigation, useRoute } from '@react-navigation/native';
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
  const { sendMessage, joinChat, leaveChat, onMessage, onMessageSent } = useWebSocket();
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
      headerTitle: chatName,
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
      headerRight: () => (
        <TouchableOpacity style={{ paddingRight: 16 }}>
          <Text style={{ fontSize: 20 }}>⋮</Text>
        </TouchableOpacity>
      ),
    });

    return () => {
      if (tabNavigation) {
        tabNavigation.setOptions({
          tabBarStyle: {} // 恢复 tab bar
        });
      }
    };
  }, [navigation, chatName, tabNavigation]);

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

    // 先关闭菜单
    setShowMessageActionMenu(false);

    if (action === 'translate') {
      // 保留 selectedMessage 供 MessageTranslateModal 使用
      setShowMessageTranslate(true);
    } else if (action === 'copy') {
      Clipboard.setString(selectedMessage.text);
      Alert.alert('已复制', '消息已复制到剪贴板');
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
            setSelectedMessage(null);
            setMessageBubbleRef(null);
            setAnchorPosition(null);
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
