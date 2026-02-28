import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
  ActivityIndicator,
  Image,
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
import { Message, Conversation } from '../database/models';
import { getDatabase } from '../database';
import { API_CONFIG } from '../config/constants';
import { getAuthToken } from '../services/ApiService';
import { ChatDetailScreenNavigationProp, ChatDetailScreenRouteProp } from '../types/navigation';
import { RouteProp } from '@react-navigation/native';
import { getAvatarUrl } from '../utils/avatar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useWebSocket } from '../contexts/WebSocketContext';
import { generateDirectConversationId, generateGroupConversationId, isGroupConversation } from '../utils/conversationId';
import { useAuth } from '../contexts/AuthContext';
import { WebSocketMessageData } from '../types/websocket';
import { getConversationInfo } from '../api/conversations';
import { Friend, Group } from '../database/models';
import TranslationAssistantModal from '../components/TranslationAssistantModal';
import { ContextMessage } from '../api/assistant';

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
  senderId?: string;
  senderAvatar?: string;
  timestamp: string;
  sending?: boolean;
  failed?: boolean;  // 发送失败标记
}

const ChatDetailScreen = () => {
  const navigation = useNavigation<ChatDetailScreenNavigationProp>();
  const route = useRoute<ChatDetailScreenRouteProp>();
  const parentNavigation = useNavigation();
  const tabNavigation = parentNavigation.getParent();
  const { sendMessage, joinChat, leaveChat, onMessage, onMessageSent } = useWebSocket();
  const { user } = useAuth();

  // Get the current user's database instance
  const database = getDatabase() || useDatabase();
  const chatId = route.params.chatId;
  const chatName = route.params.chatName;
  const chatType = route.params.chatType || 'direct';

  // Generate conversationId based on chat type
  const conversationId = React.useMemo(() => {
    if (chatType === 'group') {
      return generateGroupConversationId(chatId);
    }
    // For direct chat, use min(uid1, uid2) + '_' + max(uid1, uid2)
    const currentUserId = user?.id || '';
    return generateDirectConversationId(currentUserId, chatId);
  }, [chatId, chatType, user?.id]);

  const [messages, setMessages] = useState<MessageInterface[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showTranslationAssistant, setShowTranslationAssistant] = useState(false);
  const [latestMsgId, setLatestMsgId] = useState<string | null>(null); // 最新已同步的 msgId
  
  // 超时定时器管理
  const sendingTimeouts = useRef<Map<string, any>>(new Map());
  const SENDING_TIMEOUT = 10000; // 10 秒超时

  // Store friend avatars for use in subscription callback
  const friendAvatarsRef = useRef<Map<string, string>>(new Map());

  console.log('[ChatDetailScreen] route.params:', route.params);
  console.log('[ChatDetailScreen] chatId:', chatId, 'chatType:', chatType);
  console.log('[ChatDetailScreen] conversationId:', conversationId);

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

  // Sync conversation info (to update friend/group info)
  const syncConversationInfo = React.useCallback(async () => {
    try {
      console.log('[ChatDetailScreen] Syncing conversation info:', conversationId);
      
      const info = await getConversationInfo(conversationId);
      console.log('[ChatDetailScreen] Conversation info:', info);

      if (!database) {
        console.log('[ChatDetailScreen] Database not available, skipping contact update');
        return;
      }

      // Update friend or group info in local database
      await database.write(async () => {
        if (info.type === 'direct') {
          // Update friend info
          const existingFriends = await database.collections
            .get<Friend>('friends')
            .query(Q.where('friend_id', Q.eq(info.targetId)))
            .fetch();

          if (existingFriends.length > 0) {
            await existingFriends[0].update((f: Friend) => {
              f.name = info.name;
              f.avatarUrl = info.avatarUrl || undefined;
              f.updatedAt = Date.now();
            });
          } else {
            await database.collections.get<Friend>('friends').create((f: Friend) => {
              f.friendId = info.targetId;
              f.name = info.name;
              f.avatarUrl = info.avatarUrl || undefined;
              f.createdAt = Date.now();
              f.updatedAt = Date.now();
            });
          }
          console.log('[ChatDetailScreen] Friend info synced:', info.targetId);
        } else {
          // Update group info
          const existingGroups = await database.collections
            .get<Group>('groups')
            .query(Q.where('group_id', Q.eq(info.targetId)))
            .fetch();

          if (existingGroups.length > 0) {
            await existingGroups[0].update((g: Group) => {
              g.name = info.name;
              g.avatarUrl = info.avatarUrl || undefined;
              g.updatedAt = Date.now();
            });
          } else {
            await database.collections.get<Group>('groups').create((g: Group) => {
              g.groupId = info.targetId;
              g.name = info.name;
              g.avatarUrl = info.avatarUrl || undefined;
              g.ownerId = ''; // TODO: Get from group info
              g.memberIds = '[]';
              g.createdAt = Date.now();
              g.updatedAt = Date.now();
            });
          }
          console.log('[ChatDetailScreen] Group info synced:', info.targetId);
        }
      });
    } catch (error) {
      console.error('[ChatDetailScreen] Sync conversation info error:', error);
    }
  }, [database, conversationId]);

  // Save message from WebSocket to local database
  const saveMessageToLocal = React.useCallback(async (data: WebSocketMessageData) => {
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
          await localMessage.update((msg: Message) => {
            msg.status = 'sent';
          });
        });
        console.log('[ChatDetailScreen] Message status updated to sent');
      } else {
        // 创建新消息（接收到的消息）
        await database.write(async () => {
          await database.collections.get<Message>('messages').create((message: Message) => {
            message.msgId = data.msgId;
            message.conversationId = data.conversationId || conversationId;
            message.chatType = data.chatType || 'direct';
            message.targetId = data.targetId || chatId;
            message.text = data.text;
            message.senderId = data.senderId;
            message.chatSessionId = data.targetId || chatId; // 保留字段用于兼容
            message.status = data.status || 'sent';
            message.timestamp = data.createdAt ? new Date(data.createdAt).getTime() : Date.now();
          });
        });
        console.log('[ChatDetailScreen] New message saved to local');
      }
    } catch (error) {
      console.error('[ChatDetailScreen] Save message to local failed:', error);
    }
  }, [database, conversationId, chatId]);

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
          conversationId,
          minMsgId,
        }),
      });

      const data: any = await response.json();

      if (response.ok && data.success) {
        console.log('[ChatDetailScreen] Acked messages, minMsgId:', minMsgId);
        console.log('[ChatDetailScreen] Acknowledged messages, unread count updated on server');
      } else {
        console.error('[ChatDetailScreen] Ack failed:', data.error);
      }
    } catch (error: any) {
      console.error('[ChatDetailScreen] Ack error:', error.message);
    }
  }, [conversationId, database]);

  // Sync messages from server
  const syncMessagesFromServer = React.useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        console.log('[ChatDetailScreen] No token, skip sync');
        return;
      }

      const url = `${API_CONFIG.BASE_URL}/api/chats/messages/sync?conversationId=${conversationId}&chatType=${chatType}`;

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

        // Clear local unread count first
        if (database) {
          try {
            const conversations = await database.collections
              .get<Conversation>('conversations')
              .query(Q.where('conversation_id', Q.eq(conversationId)))
              .fetch();

            if (conversations.length > 0) {
              await database.write(async () => {
                await conversations[0].update((c: Conversation) => {
                  c.unreadCount = 0;
                  c.updatedAt = Date.now();
                });
              });
              console.log('[ChatDetailScreen] Local unread count cleared');
            }
          } catch (e) {
            console.error('[ChatDetailScreen] Clear local unread count error:', e);
          }
        }

        // Save messages to local database
        if (data.data.messages.length > 0) {
          await database.write(async () => {
            for (const msg of data.data.messages) {
              try {
                // Check if message already exists
                const existing = await database.collections
                  .get<Message>('messages')
                  .query(Q.where('msg_id', Q.eq(msg.msgId)))
                  .fetch();

                if (existing.length === 0) {
                  // Create new message
                  await database.collections.get<Message>('messages').create((message: any) => {
                    message.msgId = msg.msgId;
                    message.conversationId = msg.conversationId || conversationId;
                    message.chatType = msg.chatType || 'direct';
                    message.targetId = msg.targetId;
                    message.text = msg.text;
                    message.senderId = msg.senderId;
                    message.chatSessionId = msg.senderId;
                    message.status = msg.status;
                    message.timestamp = new Date(msg.createdAt).getTime();
                  });
                  console.log('[ChatDetailScreen] Saved message to local:', msg.msgId);
                } else {
                  console.log('[ChatDetailScreen] Message already exists, skip:', msg.msgId);
                }
              } catch (e) {
                console.log('[ChatDetailScreen] Save message error:', msg.msgId, e);
              }
            }
          });
          console.log('[ChatDetailScreen] All messages saved to local');

          // Acknowledge messages immediately after saving
          const minMsgId = data.data.messages[0]?.msgId; // First message (oldest)
          if (minMsgId) {
            console.log('[ChatDetailScreen] Calling ackMessages with minMsgId:', minMsgId);
            await ackMessages(minMsgId);
          }
        } else {
          console.log('[ChatDetailScreen] No messages to sync');
        }
      } else {
        console.error('[ChatDetailScreen] Sync failed:', data.error);
      }
    } catch (error: any) {
      console.error('[ChatDetailScreen] Sync error:', error.message);
    }
  }, [conversationId, chatType, database, ackMessages]);

  // Load more history messages
  const handleLoadMore = React.useCallback(async () => {
    if (isSyncing || !hasMore) {
      console.log('[ChatDetailScreen] Skip load more: isSyncing=', isSyncing, 'hasMore=', hasMore);
      return;
    }

    setIsSyncing(true);
    try {
      // Get the earliest message (last in the inverted list)
      const earliestMsg = messages[messages.length - 1];
      console.log('[ChatDetailScreen] Loading history messages, earliestMsgId:', earliestMsg?.msgId);

      const token = await getAuthToken();
      if (!token) {
        console.log('[ChatDetailScreen] No token, skip load more');
        return;
      }

      const url = `${API_CONFIG.BASE_URL}/api/chats/messages/history?conversationId=${conversationId}&chatType=${chatType}&beforeMsgId=${earliestMsg?.msgId || ''}`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data: any = await response.json();

      if (response.ok && data.success) {
        console.log('[ChatDetailScreen] Loaded', data.data.messages.length, 'history messages');

        if (data.data.messages.length > 0) {
          await database.write(async () => {
            for (const msg of data.data.messages) {
              try {
                // Check if message already exists
                const existing = await database.collections
                  .get<Message>('messages')
                  .query(Q.where('msg_id', Q.eq(msg.msgId)))
                  .fetch();

                if (existing.length === 0) {
                  // Create new message
                  await database.collections.get<Message>('messages').create((message: any) => {
                    message.msgId = msg.msgId;
                    message.conversationId = msg.conversationId || conversationId;
                    message.chatType = msg.chatType || 'direct';
                    message.targetId = msg.targetId;
                    message.text = msg.text;
                    message.senderId = msg.senderId;
                    message.chatSessionId = msg.senderId;
                    message.status = msg.status;
                    message.timestamp = new Date(msg.createdAt).getTime();
                  });
                  console.log('[ChatDetailScreen] Saved history message to local:', msg.msgId);
                } else {
                  console.log('[ChatDetailScreen] History message already exists, skip:', msg.msgId);
                }
              } catch (e) {
                console.log('[ChatDetailScreen] Save history message error:', msg.msgId, e);
              }
            }
          });

          // If loaded messages < limit, no more messages
          if (data.data.messages.length < 50) {
            setHasMore(false);
          }
        } else {
          setHasMore(false);
        }
      } else {
        console.error('[ChatDetailScreen] Load history failed:', data.error);
      }
    } catch (error: any) {
      console.error('[ChatDetailScreen] Load history error:', error.message);
    } finally {
      setIsSyncing(false);
    }
  }, [messages, isSyncing, hasMore, conversationId, chatType, database]);

  // Listen for message_sent event and update local message status
  const handleMessageSent = React.useCallback((data: WebSocketMessageData) => {
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
            await messages[0].update((m: Message) => {
              m.status = 'sent';
              console.log('[ChatDetailScreen] Updating message status to: sent');
            });
            console.log('[ChatDetailScreen] Message update completed in database.write');

            // Update Conversation's latest message info
            const conversations = await database.collections
              .get<Conversation>('conversations')
              .query(Q.where('conversation_id', Q.eq(conversationId)))
              .fetch();

            if (conversations.length > 0) {
              await conversations[0].update((c: Conversation) => {
                c.latestMsgId = data.msgId;
                c.latestSummary = messages[0].text;
                c.latestSenderId = data.senderId || 'unknown';
                c.updatedAt = Date.now();
              });
              console.log('[ChatDetailScreen] Updated Conversation latest message');
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
          
          // Clear the sending timeout
          if (data.msgId && sendingTimeouts.current.has(data.msgId)) {
            const timeout = sendingTimeouts.current.get(data.msgId);
            if (timeout) {
              clearTimeout(timeout);
              sendingTimeouts.current.delete(data.msgId);
            }
          }
        } else {
          console.log('[ChatDetailScreen] No local message found with msgId:', data.msgId);
        }
      } catch (error) {
        console.error('[ChatDetailScreen] Update local message error:', error);
      }
    };

    updateLocalMessage();
  }, [database, conversationId]);

  useEffect(() => {
    // Fetch messages from the database for this conversation using conversationId
    const fetchMessages = async () => {
      try {
        if (!database) {
          console.error('Database is not available');
          return;
        }

        console.log('[ChatDetailScreen] Fetching messages for conversationId:', conversationId);

        const dbMessages = await database.collections
          .get<Message>('messages')
          .query(
            Q.where('conversation_id', Q.eq(conversationId)),
            Q.sortBy('timestamp', Q.desc)
          )
          .fetch();

        console.log('[ChatDetailScreen] Fetched', dbMessages.length, 'messages');

        // Get all unique sender IDs
        const senderIds = [...new Set(dbMessages.map(msg => msg.senderId).filter(Boolean))];
        
        // Query friend/users info for avatars
        let friendAvatars: Map<string, string> = new Map();
        if (senderIds.length > 0 && chatType === 'direct') {
          // For direct chat, query the other user's info
          const otherUserId = senderIds.find(id => id !== user?.id);
          if (otherUserId) {
            const friends = await database.collections
              .get<Friend>('friends')
              .query(Q.where('friend_id', Q.eq(otherUserId)))
              .fetch();
            
            friends.forEach(f => {
              friendAvatars.set(f.friendId, f.avatarUrl || '');
            });
          }
        } else if (senderIds.length > 0 && chatType === 'group') {
          // For group chat, query all senders' info
          const friends = await database.collections
            .get<Friend>('friends')
            .query()
            .fetch();
          
          friends.forEach(f => {
            friendAvatars.set(f.friendId, f.avatarUrl || '');
          });
        }

        // Store in ref for use in subscription callback
        friendAvatarsRef.current = friendAvatars;

        // Convert database records to the format expected by the UI
        const formattedMessages = dbMessages.map(msg => {
          const isMe = msg.senderId === user?.id;
          const sender: 'me' | 'other' = isMe ? 'me' : 'other';
          const senderAvatar = isMe ? user?.avatarUrl : (friendAvatars.get(msg.senderId) || '');
          
          return {
            id: msg.id,
            msgId: msg.msgId,
            text: msg.text,
            sender,
            senderId: msg.senderId,
            senderAvatar,
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
      console.log('[ChatDetailScreen] Joining chat room:', conversationId);
      joinChat(conversationId);

      // Set up a subscription to listen for changes in the database using conversationId
      const subscription = database.collections
        .get<Message>('messages')
        .query(
          Q.where('conversation_id', Q.eq(conversationId)),
          Q.sortBy('timestamp', Q.desc)
        )
        .observe()
        .subscribe((dbMessages) => {
          console.log('[ChatDetailScreen] Database subscription triggered:', dbMessages.length, 'messages');

          const formattedMessages = dbMessages.map(msg => {
            const isMe = msg.senderId === user?.id;
            const sender: 'me' | 'other' = isMe ? 'me' : 'other';
            const senderAvatar = isMe
              ? user?.avatarUrl
              : (friendAvatarsRef.current.get(msg.senderId) || '');

            return {
              id: msg.id,
              msgId: msg.msgId,
              text: msg.text,
              sender,
              senderId: msg.senderId,
              senderAvatar,
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

      // Sync conversation info (to update friend/group info)
      syncConversationInfo();

      // Clean up subscription when component unmounts
      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
        unsubscribeMessage();
        unsubscribeMessageSent();
        leaveChat(conversationId);
        
        // Clear all sending timeouts
        sendingTimeouts.current.forEach((timeout) => clearTimeout(timeout));
        sendingTimeouts.current.clear();
      };
    }
  }, [database, conversationId, onMessage, handleMessageSent, syncMessagesFromServer, joinChat, leaveChat, syncConversationInfo]);

  const handleSendMessage = async () => {
    console.log('[ChatDetailScreen] handleSendMessage called');
    console.log('[ChatDetailScreen] inputText:', inputText);
    console.log('[ChatDetailScreen] conversationId:', conversationId);

    if (inputText.trim() === '' || !database) {
      console.log('[ChatDetailScreen] Skipping send: empty text or no database');
      return;
    }

    try {
      // 生成消息 ID
      const msgId = generateMsgId();
      const tempId = `temp_${Date.now()}`; // 临时 ID 用于本地显示

      // 获取当前用户 ID（从 AuthContext 获取）
      const currentUserId = user?.id || '';
      const timestamp = Date.now();

      // 1. 立即添加到本地数据库（sending: true）并更新 conversation
      await database.write(async () => {
        // Add message
        await database.collections.get<Message>('messages').create((message: any) => {
          message.msgId = msgId;
          message.conversationId = conversationId;
          message.chatType = 'direct';
          message.targetId = chatId;
          message.text = inputText;
          message.senderId = currentUserId;
          message.chatSessionId = chatId; // 保留字段用于兼容
          message.status = 'sending';
          message.timestamp = timestamp;
          message.createdAt = timestamp;
          message.updatedAt = timestamp;
        });

        // Update conversation with latest message info (don't change unreadCount)
        const existingConversations = await database.collections
          .get<Conversation>('conversations')
          .query(Q.where('conversation_id', Q.eq(conversationId)))
          .fetch();

        if (existingConversations.length > 0) {
          await existingConversations[0].update((c: Conversation) => {
            c.latestMsgId = msgId;
            c.latestSummary = inputText;
            c.latestSenderId = currentUserId;
            c.latestTimestamp = timestamp;
            c.updatedAt = timestamp;
            // Don't change unreadCount - it should remain the same
          });
        } else {
          await database.collections.get<Conversation>('conversations').create((c: Conversation) => {
            c.conversationId = conversationId;
            c.type = 'direct';
            c.targetId = chatId;
            c.latestMsgId = msgId;
            c.latestSummary = inputText;
            c.latestSenderId = currentUserId;
            c.latestTimestamp = timestamp;
            c.unreadCount = 0; // New conversation, no unread messages
            c.createdAt = timestamp;
            c.updatedAt = timestamp;
          });
        }
      });
      console.log('[ChatDetailScreen] Message saved to local with sending status, conversation updated');

      // 2. 通过 WebSocket 发送消息到后端（带上 msgId 和 chatType）
      console.log('[ChatDetailScreen] Calling sendMessage via WebSocket with msgId:', msgId);
      sendMessage(conversationId, inputText, 'text', msgId, 'direct');

      // 设置超时定时器
      const timeout = setTimeout(() => {
        console.log('[ChatDetailScreen] Message sending timeout:', msgId);
        // Update message status to failed
        setMessages(prev =>
          prev.map(msg =>
            msg.msgId === msgId ? { ...msg, sending: false, failed: true } : msg
          )
        );
        sendingTimeouts.current.delete(msgId);
      }, SENDING_TIMEOUT);
      
      sendingTimeouts.current.set(msgId, timeout);

      // Clear the input
      setInputText('');
    } catch (error) {
      console.error('[ChatDetailScreen] Error sending message:', error);
    }
  };

  // 重发消息
  const handleRetryMessage = async (message: MessageInterface) => {
    console.log('[ChatDetailScreen] Retrying message:', message.msgId);
    
    if (!message.text || !database) return;

    try {
      // 生成新的消息 ID
      const newMsgId = generateMsgId();
      const timestamp = Date.now();
      const currentUserId = user?.id || '';

      // 更新数据库中的消息
      await database.write(async () => {
        const messages = await database.collections
          .get<Message>('messages')
          .query(Q.where('msg_id', Q.eq(message.msgId || '')))
          .fetch();

        if (messages.length > 0) {
          await messages[0].update((msg: any) => {
            msg.msgId = newMsgId;
            msg.status = 'sending';
            msg.timestamp = timestamp;
            msg.updatedAt = timestamp;
          });
        }
      });

      // 更新 UI 状态
      setMessages(prev =>
        prev.map(msg =>
          msg.msgId === message.msgId
            ? { ...msg, msgId: newMsgId, sending: true, failed: false, timestamp: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
            : msg
        )
      );

      // 通过 WebSocket 重新发送
      sendMessage(conversationId, message.text, 'text', newMsgId, 'direct');

      // 设置新的超时定时器
      const timeout = setTimeout(() => {
        console.log('[ChatDetailScreen] Retry message timeout:', newMsgId);
        setMessages(prev =>
          prev.map(msg =>
            msg.msgId === newMsgId ? { ...msg, sending: false, failed: true } : msg
          )
        );
        sendingTimeouts.current.delete(newMsgId);
      }, SENDING_TIMEOUT);

      sendingTimeouts.current.set(newMsgId, timeout);
    } catch (error) {
      console.error('[ChatDetailScreen] Retry message error:', error);
    }
  };

  const handleLongPress = () => {
    if (inputText.trim() === '') return;
    setShowTranslationAssistant(true);
  };

  const handleCloseTranslationAssistant = () => {
    setShowTranslationAssistant(false);
  };

  const handleAcceptTranslation = async (selectedText: string) => {
    if (!database) return;

    try {
      // 使用选中的翻译结果作为消息发送
      const newMessage = await database.write(async () => {
        return database.collections.get<Message>('messages').create(message => {
          message.text = selectedText;
          message.senderId = user?.id || '';
          message.chatSessionId = chatId;
          message.status = 'sent';
          message.timestamp = Date.now();
        });
      });

      // 通过 WebSocket 发送消息到后端
      const msgId = generateMsgId();
      sendMessage(conversationId, selectedText, 'text', msgId, chatType);

      // 清空输入框
      setInputText('');
      // 关闭模态框
      setShowTranslationAssistant(false);
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
        styles.messageRow,
        item.sender === 'me' ? styles.myMessageRow : styles.otherMessageRow
      ]}
    >
      {/* Avatar for other's messages */}
      {item.sender === 'other' && item.senderAvatar && (
        <Image
          source={{ uri: getAvatarUrl(item.senderAvatar, 40) }}
          style={styles.messageAvatar}
        />
      )}

      {/* Status indicator (loading or failed) */}
      {item.sending && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color="#999" />
        </View>
      )}
      {item.failed && (
        <TouchableOpacity
          style={styles.statusContainer}
          onPress={() => handleRetryMessage(item)}
        >
          <View style={styles.failedIcon}>
            <Text style={styles.failedText}>!</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Message Bubble */}
      <View
        style={[
          styles.messageBubble,
          item.sender === 'me' ? styles.myMessage : styles.otherMessage,
          item.failed && styles.failedMessage
        ]}
      >
        <View style={styles.messageContent}>
          <Text style={[
            styles.messageText,
            styles.messageTextWrap,
            item.sender === 'me' ? styles.myMessageText : styles.otherMessageText
          ]}>
            {item.text}
          </Text>
        </View>
        {item.sending && <Text style={styles.messageStatus}>发送中...</Text>}
        {item.failed && <Text style={styles.failedStatus}>点击重试</Text>}
      </View>

      {/* Avatar for my messages */}
      {item.sender === 'me' && item.senderAvatar && (
        <Image
          source={{ uri: getAvatarUrl(item.senderAvatar, 40) }}
          style={styles.messageAvatar}
        />
      )}
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
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isSyncing ? <ActivityIndicator size="small" color="#999" /> : null}
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

      {/* 翻译助手模态框 */}
      {showTranslationAssistant && (
        <TranslationAssistantModal
          visible={showTranslationAssistant}
          onClose={handleCloseTranslationAssistant}
          userInput={inputText}
          conversationId={conversationId}
          onAccept={handleAcceptTranslation}
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
    maxWidth: '70%',
    padding: 12,
    marginVertical: 5,
    marginHorizontal: 4,
    borderRadius: 12,
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
  messageContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  messageLoading: {
    marginRight: 5,
  },
  messageStatus: {
    fontSize: 10,
    color: '#999999',
    marginTop: 4,
  },
  statusContainer: {
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  failedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  failedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  failedMessage: {
    opacity: 0.8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  failedStatus: {
    fontSize: 10,
    color: '#FF3B30',
    marginLeft: 5,
  },
  messageTextWrap: {
    flex: 1,
    flexWrap: 'wrap',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginHorizontal: 8,
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
});

export default ChatDetailScreen;