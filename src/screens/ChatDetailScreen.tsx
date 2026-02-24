import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useDerivedValue,
} from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Q } from '@nozbe/watermelondb';
import { Message, ChatSession } from '../database/models';
import { getDatabase } from '../database';
import { API_CONFIG } from '../config/constants';
import { getAuthToken } from '../services/ApiService';
import { ChatDetailScreenNavigationProp, ChatDetailScreenRouteProp } from '../types/navigation';
import { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useWebSocket } from '../contexts/WebSocketContext';

// 生成消息 ID（时间戳 + 随机数）
const generateMsgId = () => {
  const timestamp = Date.now().toString(36); // 36 进制时间戳
  const random = Math.random().toString(36).substring(2, 8); // 6 位随机数
  return `msg_${timestamp}_${random}`;
  // 示例：msg_m4k7j2x8n3p9
};

interface MessageInterface {
  id: string;
  msgId?: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: string;
  sending?: boolean;
}

const ChatDetailScreen = () => {
  const navigation = useNavigation<ChatDetailScreenNavigationProp>();
  const route = useRoute<ChatDetailScreenRouteProp>();
  const parentNavigation = useNavigation();
  const tabNavigation = parentNavigation.getParent();
  const { sendMessage, joinChat, leaveChat, onMessage, onMessageSent } = useWebSocket();

  // Get the current user's database instance
  const database = getDatabase() || useDatabase();
  const chatId = route.params.chatId;
  const chatName = route.params.chatName;
  const chatType = route.params.chatType || 'direct';

  const [messages, setMessages] = useState<MessageInterface[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [latestMsgId, setLatestMsgId] = useState<string | null>(null); // 最新已同步的 msgId

  console.log('[ChatDetailScreen] route.params:', route.params);
  console.log('[ChatDetailScreen] chatId:', chatId, 'chatType:', chatType);

  const scrollViewRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();  // 获取键盘动画高度（共享值，平滑动画）

  // 衍生值：键盘高度（用于上推 FlatList）
  const translateY = useDerivedValue(() => {
    return withTiming(keyboardHeight.value, { duration: 0});  // 向上移动，duration 200 为平滑过渡
  });

  // FlatList 的动画样式
  const animatedListStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    console.log("insets.bottom", insets.bottom);
    
    // Hide the tab bar when this screen is active
    if (tabNavigation) {
      tabNavigation.setOptions({
        tabBarStyle: { display: 'none' },
      });
    }
    
    // 设置页面标题和自定义头部
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

    // Cleanup function to restore the tab bar when leaving this screen
    return () => {
      if (tabNavigation) {
        tabNavigation.setOptions({
          tabBarStyle: {} // Restore default tab bar style
        });
      }
    };
  }, [navigation, chatName, tabNavigation]);

  // Save message from WebSocket to local database
  const saveMessageToLocal = React.useCallback(async (data: any) => {
    if (!database) return;

    try {
      console.log('[ChatDetailScreen] saveMessageToLocal called with:', data);
      
      // 通过 msgId 查找（用于更新发送中的消息）
      let localMessage = null;
      if (data.msgId) {
        const messagesByMsgId = await database.collections
          .get<Message>('messages')
          .query(Q.where('msg_id', Q.eq(data.msgId)))
          .fetch();
        localMessage = messagesByMsgId[0];
        console.log('[ChatDetailScreen] Found message by msgId:', localMessage ? 'yes' : 'no');
      }

      if (localMessage) {
        // 更新现有消息状态（sending -> sent）
        await database.write(async () => {
          await localMessage.update((msg: any) => {
            msg.status = 'sent';
          });
        });
        console.log('[ChatDetailScreen] Message status updated to sent');
      } else {
        // 创建新消息（接收到的消息）
        await database.write(async () => {
          await database.collections.get<Message>('messages').create((message: any) => {
            message.msgId = data.msgId;
            message.chatType = data.chatType || 'direct';
            message.targetId = data.targetId || chatId;
            message.text = data.text;
            message.senderId = data.senderId;
            message.chatSessionId = data.targetId || chatId;
            message.status = data.status || 'sent';
            message.timestamp = data.createdAt || Date.now();
          });
        });
        console.log('[ChatDetailScreen] New message saved to local');
      }
    } catch (error) {
      console.error('[ChatDetailScreen] Save message to local failed:', error);
    }
  }, [database, chatId]);

  // Sync messages from server
  const syncMessagesFromServer = React.useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        console.log('[ChatDetailScreen] No token, skip sync');
        return;
      }

      const url = `${API_CONFIG.BASE_URL}/api/chats/messages/sync?targetId=${chatId}&chatType=direct`;

      console.log('[ChatDetailScreen] Syncing messages from server:', url);

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data: any = await response.json();

      if (response.ok && data.success) {
        console.log('[ChatDetailScreen] Synced', data.data.messages.length, 'messages');
        console.log('[ChatDetailScreen] Sync response:', JSON.stringify(data.data));

        // Save messages to local database
        if (data.data.messages.length > 0) {
          await database.write(async () => {
            for (const msg of data.data.messages) {
              try {
                await database.collections.get<Message>('messages').create((message: any) => {
                  // message.id = msg.id;
                  message.msgId = msg.msgId;
                  message.chatType = msg.chatType || 'direct';
                  message.targetId = msg.targetId;
                  message.text = msg.text;
                  message.senderId = msg.senderId;
                  message.chatSessionId = msg.senderId;
                  message.status = msg.status;
                  message.timestamp = new Date(msg.createdAt).getTime();
                });
                console.log('[ChatDetailScreen] Saved message to local:', msg.msgId);
              } catch (e) {
                console.log('[ChatDetailScreen] Message already exists:', msg.id, msg.msgId, e);
              }
            }
          });
          console.log('[ChatDetailScreen] All messages saved to local');

        } else {
          console.log('[ChatDetailScreen] No messages to sync');
        }
        // Acknowledge messages
        if (data.data.minMsgId) {
          console.log('[ChatDetailScreen] Calling ackMessages with minMsgId:', data.data.minMsgId);
          await ackMessages(data.data.minMsgId);
        }
      } else {
        console.error('[ChatDetailScreen] Sync failed:', data.error);
      }
    } catch (error: any) {
      console.error('[ChatDetailScreen] Sync error:', error.message);
    }
  }, [chatId, database]);

  // Acknowledge messages
  const ackMessages = React.useCallback(async (minMsgId: string) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        console.log('[ChatDetailScreen] No token, skip ack');
        return;
      }

      console.log('[ChatDetailScreen] Acking messages, minMsgId:', minMsgId);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/chats/messages/ack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetId: chatId,
          minMsgId,
        }),
      });

      const data: any = await response.json();

      if (response.ok && data.success) {
        console.log('[ChatDetailScreen] Acked', data.data.count, 'messages');
        
        // Update local ChatSession unreadCount to 0
        if (database) {
          await database.write(async () => {
            const sessions = await database.collections
              .get<ChatSession>('chat_sessions')
              .query(Q.where('target_id', Q.eq(chatId)))
              .fetch();
            
            if (sessions.length > 0) {
              await sessions[0].update((s: any) => {
                s.unreadCount = 0;
              });
              console.log('[ChatDetailScreen] Updated session unreadCount to 0');
            }
          });
        }
      } else {
        console.error('[ChatDetailScreen] Ack failed:', data.error);
      }
    } catch (error: any) {
      console.error('[ChatDetailScreen] Ack error:', error.message);
    }
  }, [chatId, database]);

  // Listen for message_sent event and update local message status
  const handleMessageSent = React.useCallback((data: any) => {
    console.log('[ChatDetailScreen] Received message_sent event:', JSON.stringify(data));
    
    // Find the local message by msgId and update status
    const updateLocalMessage = async () => {
      try {
        if (!database || !data.msgId) {
          console.log('[ChatDetailScreen] No database or msgId, skipping update');
          return;
        }
        
        // Find message by msgId
        const messages = await database.collections
          .get<Message>('messages')
          .query(Q.where('msg_id', Q.eq(data.msgId)))
          .fetch();
        
        console.log('[ChatDetailScreen] Found', messages.length, 'local messages with msgId:', data.msgId);
        console.log('[ChatDetailScreen] Current status:', messages[0]?.status);
        
        if (messages.length > 0) {
          await database.write(async () => {
            await messages[0].update((m: any) => {
              m.status = 'sent';
              console.log('[ChatDetailScreen] Updating message status to: sent');
            });
            console.log('[ChatDetailScreen] Message update completed in database.write');
            
            // Update ChatSession's last_message_time and last_message_text
            const sessions = await database.collections
              .get<ChatSession>('chat_sessions')
              .query(Q.where('target_id', Q.eq(chatId)))
              .fetch();
            
            if (sessions.length > 0) {
              await sessions[0].update((s: any) => {
                s.last_message_time = Date.now();
                s.last_message_text = messages[0].text;
                s.last_message_id = data.msgId;
                console.log('[ChatDetailScreen] Updated ChatSession last_message_time');
              });
            }
          });
          console.log('[ChatDetailScreen] Database write completed');
          
          // Manually update UI state to reflect the status change
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg.msgId === data.msgId 
                ? { ...msg, sending: false }
                : msg
            )
          );
          console.log('[ChatDetailScreen] UI state updated');
        } else {
          console.log('[ChatDetailScreen] No local message found with msgId:', data.msgId);
        }
      } catch (error) {
        console.error('[ChatDetailScreen] Update local message error:', error);
      }
    };
    
    updateLocalMessage();
  }, [database, chatId]);

  useEffect(() => {
    // Fetch messages from the database for this chat using targetId
    const fetchMessages = async () => {
      try {
        if (!database) {
          console.error('Database is not available');
          return;
        }

        console.log('[ChatDetailScreen] Fetching messages for targetId:', chatId);

        const dbMessages = await database.collections
          .get<Message>('messages')
          .query(
            Q.where('chat_session_id', Q.eq(chatId)),
            Q.sortBy('timestamp', Q.desc)
          )
          .fetch();

        console.log('[ChatDetailScreen] Fetched', dbMessages.length, 'messages');

        // Convert database records to the format expected by the UI
        const formattedMessages = dbMessages.map(msg => {
          const sender: 'me' | 'other' = msg.senderId === 'current_user_id' ? 'me' : 'other';
          return {
            id: msg.id,
            msgId: msg.msgId,
            text: msg.text,
            sender,
            timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sending: msg.status === 'sending',
          };
        });

        setMessages(formattedMessages);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    if (database) {
      fetchMessages();

      // Join chat room to receive real-time messages
      console.log('[ChatDetailScreen] Joining chat room:', chatId);
      joinChat(chatId);

      // Set up a subscription to listen for changes in the database using chatSessionId
      const subscription = database.collections
        .get<Message>('messages')
        .query(
          Q.where('chat_session_id', Q.eq(chatId)),
          Q.sortBy('timestamp', Q.desc)
        )
        .observe()
        .subscribe((dbMessages) => {
          console.log('[ChatDetailScreen] Database subscription triggered:', dbMessages.length, 'messages');

          const formattedMessages = dbMessages.map(msg => {
            const sender: 'me' | 'other' = msg.senderId === 'current_user_id' ? 'me' : 'other';
            return {
              id: msg.id,
              msgId: msg.msgId,
              text: msg.text,
              sender,
              timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              sending: msg.status === 'sending',
            };
          });

          setMessages(formattedMessages);
        });

      // Listen for incoming messages from WebSocket
      const unsubscribeMessage = onMessage((data: any) => {
        console.log('[ChatDetailScreen] Received message from WebSocket:', data);
        saveMessageToLocal(data);
        
        // Update latest msgId if this message is newer
        if (data.msgId && (!latestMsgId || data.msgId > latestMsgId)) {
          setLatestMsgId(data.msgId);
        }
      });

      // Listen for message_sent event from WebSocket (confirmation for sent messages)
      const unsubscribeMessageSent = onMessageSent(handleMessageSent);

      // Sync messages from server on mount
      syncMessagesFromServer();

      // Clean up subscription when component unmounts
      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
        unsubscribeMessage();
        unsubscribeMessageSent();
        leaveChat(chatId);
      };
    }
  }, [database, chatId, onMessage, handleMessageSent, syncMessagesFromServer, joinChat, leaveChat]);

  const handleSendMessage = async () => {
    console.log('[ChatDetailScreen] handleSendMessage called');
    console.log('[ChatDetailScreen] inputText:', inputText);
    console.log('[ChatDetailScreen] chatId:', chatId);

    if (inputText.trim() === '' || !database) {
      console.log('[ChatDetailScreen] Skipping send: empty text or no database');
      return;
    }

    try {
      // 生成消息 ID
      const msgId = generateMsgId();
      const tempId = `temp_${Date.now()}`; // 临时 ID 用于本地显示
      
      // 获取当前用户 ID（从数据库 token 或上下文）
      const currentUserId = 'current_user_id'; // TODO: 从 AuthContext 获取
      
      // 1. 立即添加到本地数据库（sending: true）
      await database.write(async () => {
        await database.collections.get<Message>('messages').create((message: any) => {
          message.msgId = msgId;
          message.chatType = 'direct';
          message.targetId = chatId;
          message.text = inputText;
          message.senderId = currentUserId;
          message.chatSessionId = chatId; // 保留字段用于兼容
          message.status = 'sending';
          message.timestamp = Date.now();
        });
      });
      console.log('[ChatDetailScreen] Message saved to local with sending status');
      
      // 2. 通过 WebSocket 发送消息到后端（带上 msgId 和 chatType）
      console.log('[ChatDetailScreen] Calling sendMessage via WebSocket with msgId:', msgId);
      sendMessage(chatId, inputText, 'text', msgId, 'direct');

      // Clear the input
      setInputText('');
    } catch (error) {
      console.error('[ChatDetailScreen] Error sending message:', error);
    }
  };

  const handleLongPress = () => {
    if (inputText.trim() === '') return;
    setShowTranslationModal(true);
  };

  const handleCloseTranslationModal = () => {
    setShowTranslationModal(false);
  };

  const handleAcceptTranslation = async () => {
    if (!database) return;

    try {
      // 使用翻译结果（hello world）作为消息发送
      const translationResult = 'hello world';
      const newMessage = await database.write(async () => {
        return database.collections.get<Message>('messages').create(message => {
          message.text = translationResult;
          message.senderId = 'current_user_id';
          message.chatSessionId = chatId;
          message.status = 'sent';
          message.timestamp = Date.now();
        });
      });

      // 清空输入框
      setInputText('');
      // 关闭模态框
      setShowTranslationModal(false);
    } catch (error) {
      console.error('Error sending translation:', error);
    }
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

  // 渲染单条消息的函数
  const renderMessage = ({ item }: { item: MessageInterface }) => (
    <View
      style={[
        styles.messageBubble,
        item.sender === 'me' ? styles.myMessage : styles.otherMessage
      ]}
    >
      <View style={styles.messageContent}>
        {item.sending && (
          <ActivityIndicator size="small" color="#999" style={styles.messageLoading} />
        )}
        <Text style={[
          styles.messageText,
          item.sender === 'me' ? styles.myMessageText : styles.otherMessageText
        ]}>
          {item.text}
        </Text>
      </View>
      <View style={styles.messageFooter}>
        <Text style={styles.messageTime}>{item.timestamp}</Text>
        {item.sending && <Text style={styles.messageStatus}>发送中...</Text>}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 用 Animated.View 包裹 FlatList，实现平滑上推 */}
      <Animated.View style={[styles.messagesWrapper, animatedListStyle]}>
        <FlatList
          ref={scrollViewRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted // 最新的消息在底部
          style={styles.messagesContainer}
          contentContainerStyle={[
            styles.flatListContent,
            { paddingBottom: 20 }  // 底部留间距，避免紧贴输入区
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            // 当内容改变时，自动滚动到底部（即最新消息，因为是inverted）
            const scrollRef = scrollViewRef.current;
            if (scrollRef && typeof scrollRef.scrollToOffset === 'function') {
              // 滚动到顶部，因为列表是倒置的
              scrollRef.scrollToOffset({ offset: 0, animated: true });
            }
          }}
        />
      </Animated.View>

      {/* 输入区：保持 KeyboardStickyView 粘附键盘顶部 */}
      <KeyboardStickyView 
        offset={{ 
          closed: 0, 
          opened: 0  // 全屏模式下推荐 0（紧贴），或 -20 留间距
        }}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="输入消息..."
            multiline
            value={inputText}
            onChangeText={setInputText}
            blurOnSubmit={false}
            onFocus={() => {
              // 键盘打开时，滚动到最新消息
              setTimeout(() => {
                const scrollRef = scrollViewRef.current;
                if (scrollRef && typeof scrollRef.scrollToOffset === 'function') {
                  // 滚动到顶部，因为列表是倒置的
                  scrollRef.scrollToOffset({ offset: 0, animated: true });
                }
              }, 200); // 增加延迟以确保动画完成
            }}
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendMessage}
            onLongPress={handleLongPress}
            delayLongPress={500}
          >
            <Text style={styles.sendButtonText}>发送</Text>
          </TouchableOpacity>
        </View>
      </KeyboardStickyView>

      {/* 翻译结果模态框 */}
      <Modal
        visible={showTranslationModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseTranslationModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>翻译结果</Text>
            <Text style={styles.modalTranslation}>hello world</Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={handleCloseTranslationModal}
              >
                <Text style={styles.modalCloseButtonText}>关闭</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalAcceptButton}
                onPress={handleAcceptTranslation}
              >
                <Text style={styles.modalAcceptButtonText}>接受</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  messagesWrapper: {
    flex: 1,  // 占满可用空间
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  scrollViewContent: {
    paddingBottom: 10,
  },
  flatListContent: {
    paddingVertical: 10,
  },
  inputContainerWrapper: {
    // 包装输入容器，便于动画处理
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 10,
    marginVertical: 5,
    borderRadius: 10,
    position: 'relative',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#333333',
  },
  messageTime: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    marginTop: 4,
  },
  messageContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageLoading: {
    marginRight: 5,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageStatus: {
    fontSize: 10,
    color: '#999999',
    marginLeft: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 5,
    backgroundColor: '#f8f8f8',
    // borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: 10,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  modalTranslation: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalCloseButton: {
    backgroundColor: '#999999',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 1,
    marginRight: 10,
  },
  modalCloseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalAcceptButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 1,
    marginLeft: 10,
  },
  modalAcceptButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default ChatDetailScreen;