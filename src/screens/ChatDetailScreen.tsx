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
import { syncContacts } from '../api/contacts';
import { getUserInfo, getUsersBatch } from '../api/user';
import { Friend, Group, GroupMember } from '../database/models';
import TranslationAssistantModal from '../components/TranslationAssistantModal';
import { ContextMessage } from '../api/assistant';
import logger from '../utils/logger';

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
  const [showTranslationAssistant, setShowTranslationAssistant] = useState(false);
  const [latestMsgId, setLatestMsgId] = useState<string | null>(null); // 最新已同步的 msgId
  
  // 超时定时器管理
  const sendingTimeouts = useRef<Map<string, any>>(new Map());
  const SENDING_TIMEOUT = 10000; // 10 秒超时

  // Store friend avatars for use in subscription callback
  const friendAvatarsRef = useRef<Map<string, string>>(new Map());

  logger.debug('ChatDetailScreen', 'route.params:', route.params);
  logger.debug('ChatDetailScreen', 'chatId:', chatId, 'chatType:', chatType);
  logger.debug('ChatDetailScreen', 'conversationId:', conversationId);

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
    logger.debug('ChatDetailScreen', 'insets.bottom:', insets.bottom);

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

  /**
   * Sync group members info
   */
  const syncGroupMembers = React.useCallback(async (groupId: string, userIds: string[]) => {
    if (!database) return;

    try {
      logger.debug('ChatDetailScreen', 'Syncing group members for group:', groupId, 'userIds:', userIds);
      const users = await getUsersBatch(userIds);

      await database.write(async () => {
        for (const user of users) {
          // Check if member already exists
          const existingMembers = await database.collections
            .get<GroupMember>('group_members')
            .query(Q.and(
              Q.where('group_id', Q.eq(groupId)),
              Q.where('user_id', Q.eq(user.id))
            ))
            .fetch();

          if (existingMembers.length > 0) {
            // Update existing member
            await existingMembers[0].update((m: GroupMember) => {
              m.name = user.name;
              m.avatarUrl = user.avatarUrl || undefined;
              m.updatedAt = Date.now();
            });
            logger.debug('ChatDetailScreen', 'Updated group member:', user.id);
          } else {
            // Create new member
            await database.collections.get<GroupMember>('group_members').create((m: GroupMember) => {
              m.groupId = groupId;
              m.userId = user.id;
              m.name = user.name;
              m.avatarUrl = user.avatarUrl || undefined;
              m.role = 'member';
              m.joinedAt = Date.now();
              m.createdAt = Date.now();
              m.updatedAt = Date.now();
            });
            logger.debug('ChatDetailScreen', 'Created group member:', user.id);
          }
        }
      });
      logger.debug('ChatDetailScreen', 'Group members synced:', userIds.length);
    } catch (error: any) {
      logger.error('ChatDetailScreen', 'Sync group members error:', error.message);
    }
  }, [database]);

  /**
   * Sync user info for direct chat
   */
  const syncUserInfo = React.useCallback(async (userId: string) => {
    if (!database) return;

    try {
      logger.debug('ChatDetailScreen', 'Syncing user info for:', userId);
      const userInfo = await getUserInfo(userId);

      await database.write(async () => {
        const existingFriends = await database.collections
          .get<Friend>('friends')
          .query(Q.where('friend_id', Q.eq(userId)))
          .fetch();

        if (existingFriends.length > 0) {
          await existingFriends[0].update((f: Friend) => {
            f.name = userInfo.name;
            f.avatarUrl = userInfo.avatarUrl || undefined;
            f.updatedAt = Date.now();
          });
          logger.debug('ChatDetailScreen', 'Updated friend info:', userId);
        } else {
          await database.collections.get<Friend>('friends').create((f: Friend) => {
            f.friendId = userId;
            f.name = userInfo.name;
            f.avatarUrl = userInfo.avatarUrl || undefined;
            f.createdAt = Date.now();
            f.updatedAt = Date.now();
          });
          logger.debug('ChatDetailScreen', 'Created friend info:', userId);
        }
      });
    } catch (error: any) {
      logger.error('ChatDetailScreen', 'Sync user info error:', error.message);
    }
  }, [database]);

  // Sync conversation info (to update friend/group info)
  const syncConversationInfo = React.useCallback(async () => {
    try {
      logger.debug('ChatDetailScreen', 'Syncing conversation info:', conversationId);

      const info = await getConversationInfo(conversationId);
      logger.debug('ChatDetailScreen', 'Conversation info:', info);

      if (!database) {
        logger.warn('ChatDetailScreen', 'Database not available, skipping contact update');
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
          logger.debug('ChatDetailScreen', 'Friend info synced:', info.targetId);
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
          logger.debug('ChatDetailScreen', 'Group info synced:', info.targetId);
        }
      });
    } catch (error) {
      logger.error('ChatDetailScreen', 'Sync conversation info error:', error);
    }
  }, [database, conversationId]);

  // Save message from WebSocket to local database
  const saveMessageToLocal = React.useCallback(async (data: WebSocketMessageData) => {
    if (!database) return;

    try {
      logger.debug('ChatDetailScreen', 'saveMessageToLocal called with:', data);

      // 通过 msgId 查找（用于更新发送中的消息）
      let localMessage = null;
      if (data.msgId) {
        const messagesByMsgId = await database.collections
          .get<Message>('messages')
          .query(Q.where('msg_id', Q.eq(data.msgId)))
          .fetch();
        localMessage = messagesByMsgId[0];
        logger.debug('ChatDetailScreen', 'Found message by msgId:', localMessage ? 'yes' : 'no');
      }

      if (localMessage) {
        // 更新现有消息状态（sending -> sent）
        await database.write(async () => {
          await localMessage.update((msg: Message) => {
            msg.status = 'sent';
          });
        });
        logger.debug('ChatDetailScreen', 'Message status updated to sent');
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
        logger.debug('ChatDetailScreen', 'New message saved to local');
      }
    } catch (error) {
      logger.error('ChatDetailScreen', 'Save message to local failed:', error);
    }
  }, [database, conversationId, chatId]);

  // Acknowledge messages
  const ackMessages = React.useCallback(async (minMsgId: string) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        logger.warn('ChatDetailScreen', 'No token, skip ack');
        return;
      }

      logger.debug('ChatDetailScreen', 'Acking messages, minMsgId:', minMsgId);

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
        logger.debug('ChatDetailScreen', 'Acked messages, minMsgId:', minMsgId);
        logger.debug('ChatDetailScreen', 'Acknowledged messages, unread count updated on server');
      } else {
        logger.error('ChatDetailScreen', 'Ack failed:', data.error);
      }
    } catch (error: any) {
      logger.error('ChatDetailScreen', 'Ack error:', error.message);
    }
  }, [conversationId, database]);

  // Sync messages from server - batch load all unread messages
  const syncMessagesFromServer = React.useCallback(async () => {
    logger.debug('ChatDetailScreen', '=== syncMessagesFromServer START ===');
    try {
      const token = await getAuthToken();
      if (!token) {
        logger.warn('ChatDetailScreen', 'No token, skip sync');
        return;
      }

      // Step 1: Batch fetch all messages to get all sender IDs
      logger.debug('ChatDetailScreen', 'Step 1: Fetching all messages in batches');
      let hasMore = true;
      let afterMsgId: string | undefined = undefined;
      const batchSize = 1000; // Messages per batch
      const allMessages: any[] = [];
      const allSenderIds = new Set<string>();

      while (hasMore) {
        const url = `${API_CONFIG.BASE_URL}/api/chats/messages/sync?` +
          `conversationId=${conversationId}&` +
          `chatType=${chatType}&` +
          `limit=${batchSize}` +
          (afterMsgId ? `&afterMsgId=${afterMsgId}` : '');

        logger.debug('ChatDetailScreen', 'Fetching batch, afterMsgId:', afterMsgId);

        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const data: any = await response.json();

        if (!response.ok || !data.success) {
          logger.error('ChatDetailScreen', 'Failed to fetch messages:', data.error);
          hasMore = false;
          continue;
        }

        logger.debug('ChatDetailScreen', 'Batch fetched:', data.data.messages.length, 'messages, hasMore:', data.data.hasMore);

        // Collect messages and sender IDs
        if (data.data.messages.length > 0) {
          allMessages.push(...data.data.messages);
          data.data.messages.forEach((m: any) => {
            if (m.senderId) allSenderIds.add(m.senderId as string);
          });
          afterMsgId = data.data.latestMsgId;
          hasMore = data.data.hasMore;
        } else {
          hasMore = false;
        }
      }

      logger.debug('ChatDetailScreen', 'All messages fetched:', allMessages.length, 'total, senders:', allSenderIds.size);

      // Step 2: For group chat, sync group members BEFORE saving messages
      if (chatType === 'group' && allSenderIds.size > 0) {
        const senderIdsArray = Array.from(allSenderIds);
        logger.debug('ChatDetailScreen', 'Step 2: Syncing group members, userIds:', senderIdsArray);
        await syncGroupMembers(chatId, senderIdsArray);
        logger.debug('ChatDetailScreen', 'Group members synced');
      }

      // Step 3: Save all messages to local database
      if (allMessages.length > 0) {
        logger.debug('ChatDetailScreen', 'Step 3: Saving', allMessages.length, 'messages to local');
        await database.write(async () => {
          for (const msg of allMessages) {
            try {
              const existing = await database.collections
                .get<Message>('messages')
                .query(Q.where('msg_id', Q.eq(msg.msgId)))
                .fetch();

              if (existing.length === 0) {
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
                logger.debug('ChatDetailScreen', 'Saved message:', msg.msgId);
              } else {
                logger.debug('ChatDetailScreen', 'Message exists, skip:', msg.msgId);
              }
            } catch (e) {
              logger.debug('ChatDetailScreen', 'Save message error:', msg.msgId, e);
            }
          }
        });
        logger.debug('ChatDetailScreen', 'All messages saved');

        // Step 4: Acknowledge messages
        const lastMsgId = allMessages[allMessages.length - 1]?.msgId;
        if (lastMsgId) {
          logger.debug('ChatDetailScreen', 'Step 4: Calling ackMessages with:', lastMsgId);
          await ackMessages(lastMsgId);

          // Clear local unread count
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
            logger.debug('ChatDetailScreen', 'Local unread count cleared');
          }

          logger.debug('ChatDetailScreen', 'ackMessages completed');
        }
      } else {
        logger.debug('ChatDetailScreen', 'No messages to sync');
      }
    } catch (error: any) {
      logger.error('ChatDetailScreen', 'Sync error:', error.message);
    } finally {
      logger.debug('ChatDetailScreen', '=== syncMessagesFromServer END ===');
    }
  }, [conversationId, chatType, chatId, database, ackMessages, syncGroupMembers]);

  // Listen for message_sent event and update local message status
  const handleMessageSent = React.useCallback((data: WebSocketMessageData) => {
    logger.debug('ChatDetailScreen', 'Received message_sent event:', JSON.stringify(data));

    // Find the local message by msgId and update status
    const updateLocalMessage = async () => {
      try {
        if (!database || !data.msgId) {
          logger.warn('ChatDetailScreen', 'No database or msgId, skipping update');
          return;
        }

        // Find message by msgId
        const messages = await database.collections
          .get<Message>('messages')
          .query(Q.where('msg_id', Q.eq(data.msgId)))
          .fetch();

        logger.debug('ChatDetailScreen', 'Found', messages.length, 'local messages with msgId:', data.msgId);
        logger.debug('ChatDetailScreen', 'Current status:', messages[0]?.status);

        if (messages.length > 0) {
          await database.write(async () => {
            await messages[0].update((m: Message) => {
              m.status = 'sent';
              logger.debug('ChatDetailScreen', 'Updating message status to: sent');
            });
            logger.debug('ChatDetailScreen', 'Message update completed in database.write');

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
              logger.debug('ChatDetailScreen', 'Updated Conversation latest message');
            }
          });
          logger.debug('ChatDetailScreen', 'Database write completed');

          // Manually update UI state to reflect the status change
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.msgId === data.msgId
                ? { ...msg, sending: false }
                : msg
            )
          );
          logger.debug('ChatDetailScreen', 'UI state updated');

          // Clear the sending timeout
          if (data.msgId && sendingTimeouts.current.has(data.msgId)) {
            const timeout = sendingTimeouts.current.get(data.msgId);
            if (timeout) {
              clearTimeout(timeout);
              sendingTimeouts.current.delete(data.msgId);
            }
          }
        } else {
          logger.debug('ChatDetailScreen', 'No local message found with msgId:', data.msgId);
        }
      } catch (error) {
        logger.error('ChatDetailScreen', 'Update local message error:', error);
      }
    };

    updateLocalMessage();
  }, [database, conversationId]);

  useEffect(() => {
    // Fetch messages from the database for this conversation using conversationId
    const fetchMessages = async () => {
      try {
        if (!database) {
          logger.error('ChatDetailScreen', 'Database is not available');
          return;
        }

        logger.debug('ChatDetailScreen', 'Fetching messages for conversationId:', conversationId);

        const dbMessages = await database.collections
          .get<Message>('messages')
          .query(
            Q.where('conversation_id', Q.eq(conversationId)),
            Q.sortBy('timestamp', Q.desc)
          )
          .fetch();

        logger.debug('ChatDetailScreen', 'Fetched', dbMessages.length, 'messages');
        logger.debug('ChatDetailScreen', 'Fetched messages details:', dbMessages.map(m => ({
          id: m.id,
          msgId: m.msgId,
          text: m.text,
          status: m.status,
          timestamp: m.timestamp
        })));

        // Get all unique sender IDs
        const senderIds = [...new Set(dbMessages.map(msg => msg.senderId).filter(Boolean))];
        logger.debug('ChatDetailScreen', 'Unique senderIds:', senderIds);

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
          // For group chat, query group members info
          logger.debug('ChatDetailScreen', '[Group] Querying group_members for groupId:', chatId);

          const groupMembers = await database.collections
            .get<GroupMember>('group_members')
            .query(Q.where('group_id', Q.eq(chatId)))
            .fetch();

          logger.debug('ChatDetailScreen', '[Group] Found', groupMembers.length, 'group members');
          logger.debug('ChatDetailScreen', '[Group] Group members details:', groupMembers.map(m => ({
            userId: m.userId,
            name: m.name,
            avatarUrl: m.avatarUrl,
            role: m.role,
          })));

          groupMembers.forEach(m => {
            friendAvatars.set(m.userId, m.avatarUrl || '');
          });

          // Also add current user's avatar
          if (user?.id) {
            friendAvatars.set(user.id, user.avatarUrl || '');
            logger.debug('ChatDetailScreen', '[Group] Added current user avatar:', user.id, user.avatarUrl);
          }

          logger.debug('ChatDetailScreen', '[Group] Final friendAvatars size:', friendAvatars.size);
        } else {
          logger.debug('ChatDetailScreen', 'Skip avatar query: senderIds.length=', senderIds.length, 'chatType=', chatType);
        }

        // Store in ref for use in subscription callback
        friendAvatarsRef.current = friendAvatars;
        logger.debug('ChatDetailScreen', 'Stored friendAvatars to ref, size:', friendAvatars.size);

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
        logger.error('ChatDetailScreen', 'Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    if (database) {
      fetchMessages();

      // Join chat room to receive real-time messages
      logger.debug('ChatDetailScreen', 'Joining chat room:', conversationId);
      joinChat(conversationId);

      // Set up a subscription to listen for changes in the database using conversationId
      const subscription = database.collections
        .get<Message>('messages')
        .query(
          Q.where('conversation_id', Q.eq(conversationId)),
          Q.sortBy('timestamp', Q.desc)
        )
        .observe()
        .subscribe(async (dbMessages) => {
          logger.debug('ChatDetailScreen', 'Database subscription triggered:', dbMessages.length, 'messages');
          logger.debug('ChatDetailScreen', 'Database subscription messages details:', dbMessages.map(m => ({
            id: m.id,
            msgId: m.msgId,
            text: m.text,
            status: m.status,
            timestamp: m.timestamp
          })));

          // Ensure friendAvatarsRef is populated (in case subscription fires before fetchMessages completes)
          // For group chat, always re-fetch group members to ensure we have the latest avatars
          if (chatType === 'group') {
            logger.debug('ChatDetailScreen', '[Subscription] Refilling friendAvatarsRef from group_members, chatId:', chatId);

            const groupMembers = await database.collections
              .get<GroupMember>('group_members')
              .query(Q.where('group_id', Q.eq(chatId)))
              .fetch();

            logger.debug('ChatDetailScreen', '[Subscription] Found', groupMembers.length, 'group members');

            // Clear and refill the map
            friendAvatarsRef.current.clear();
            groupMembers.forEach(m => {
              friendAvatarsRef.current.set(m.userId, m.avatarUrl || '');
            });

            if (user?.id) {
              friendAvatarsRef.current.set(user.id, user.avatarUrl || '');
            }

            logger.debug('ChatDetailScreen', '[Subscription] friendAvatarsRef after refill:', friendAvatarsRef.current.size, 'entries');
          }

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

          logger.debug('ChatDetailScreen', '[Subscription] Setting messages to state, count:', formattedMessages.length);

          setMessages(formattedMessages);
        });

      // Listen for incoming messages from WebSocket
      const unsubscribeMessage = onMessage((data: any) => {
        logger.info('ChatDetailScreen', 'Received message from WebSocket:', data);
        saveMessageToLocal(data);

        // Update latest msgId if this message is newer
        if (data.msgId && (!latestMsgId || data.msgId > latestMsgId)) {
          setLatestMsgId(data.msgId);
        }
      });

      // Listen for message_sent event from WebSocket (confirmation for sent messages)
      const unsubscribeMessageSent = onMessageSent(handleMessageSent);

      // Sync messages from server on mount
      logger.debug('ChatDetailScreen', 'Calling syncMessagesFromServer on mount');
      syncMessagesFromServer();

      // For direct chat, sync user info
      if (chatType === 'direct') {
        syncUserInfo(chatId);
      }

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
    logger.debug('ChatDetailScreen', 'handleSendMessage called');
    logger.debug('ChatDetailScreen', 'inputText:', inputText);
    logger.debug('ChatDetailScreen', 'conversationId:', conversationId);

    if (inputText.trim() === '' || !database) {
      logger.warn('ChatDetailScreen', 'Skipping send: empty text or no database');
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
          message.chatType = chatType; // Use the actual chat type
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
            c.type = chatType; // Use the actual chat type
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
      logger.debug('ChatDetailScreen', 'Message saved to local with sending status, conversation updated');

      // 2. 通过 WebSocket 发送消息到后端（带上 msgId 和 chatType）
      logger.debug('ChatDetailScreen', 'Calling sendMessage via WebSocket with msgId:', msgId);
      sendMessage(conversationId, inputText, 'text', msgId, chatType);

      // 设置超时定时器
      const timeout = setTimeout(() => {
        logger.warn('ChatDetailScreen', 'Message sending timeout:', msgId);
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
      logger.error('ChatDetailScreen', 'Error sending message:', error);
    }
  };

  // 重发消息
  const handleRetryMessage = async (message: MessageInterface) => {
    logger.debug('ChatDetailScreen', 'Retrying message:', message.msgId);

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
      sendMessage(conversationId, message.text, 'text', newMsgId, chatType);

      // 设置新的超时定时器
      const timeout = setTimeout(() => {
        logger.warn('ChatDetailScreen', 'Retry message timeout:', newMsgId);
        setMessages(prev =>
          prev.map(msg =>
            msg.msgId === newMsgId ? { ...msg, sending: false, failed: true } : msg
          )
        );
        sendingTimeouts.current.delete(newMsgId);
      }, SENDING_TIMEOUT);

      sendingTimeouts.current.set(newMsgId, timeout);
    } catch (error) {
      logger.error('ChatDetailScreen', 'Retry message error:', error);
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
      // 生成消息 ID
      const msgId = generateMsgId();
      const timestamp = Date.now();

      logger.debug('ChatDetailScreen', 'handleAcceptTranslation called with text:', selectedText);
      logger.debug('ChatDetailScreen', 'Generated msgId:', msgId);
      logger.debug('ChatDetailScreen', 'conversationId:', conversationId);
      logger.debug('ChatDetailScreen', 'chatType:', chatType);

      // 使用选中的翻译结果作为消息发送
      const newMessage = await database.write(async () => {
        return database.collections.get<Message>('messages').create(message => {
          message.text = selectedText;
          message.senderId = user?.id || '';
          message.chatSessionId = chatId;
          message.status = 'sending'; // Set to sending initially
          message.msgId = msgId; // Use the same msgId for local tracking
          message.timestamp = timestamp;
          message.conversationId = conversationId; // Ensure conversationId is set
          message.chatType = chatType; // Ensure chatType is set
          message.targetId = chatId; // Ensure targetId is set
        });
      });

      logger.debug('ChatDetailScreen', 'Message created in database:', {
        id: newMessage.id,
        msgId: newMessage.msgId,
        text: newMessage.text,
        conversationId: newMessage.conversationId,
        status: newMessage.status
      });

      // Update conversation with latest message info
      await database.write(async () => {
        const existingConversations = await database.collections
          .get<Conversation>('conversations')
          .query(Q.where('conversation_id', Q.eq(conversationId)))
          .fetch();

        if (existingConversations.length > 0) {
          await existingConversations[0].update((c: Conversation) => {
            c.latestMsgId = msgId;
            c.latestSummary = selectedText;
            c.latestSenderId = user?.id || '';
            c.latestTimestamp = timestamp;
            c.updatedAt = timestamp;
          });
        } else {
          await database.collections.get<Conversation>('conversations').create((c: Conversation) => {
            c.conversationId = conversationId;
            c.type = chatType;
            c.targetId = chatId;
            c.latestMsgId = msgId;
            c.latestSummary = selectedText;
            c.latestSenderId = user?.id || '';
            c.latestTimestamp = timestamp;
            c.unreadCount = 0;
            c.createdAt = timestamp;
            c.updatedAt = timestamp;
          });
        }
      });

      // 通过 WebSocket 发送消息到后端
      logger.debug('ChatDetailScreen', 'Calling sendMessage via WebSocket with msgId:', msgId);
      sendMessage(conversationId, selectedText, 'text', msgId, chatType);

      // 清空输入框
      setInputText('');
      // 关闭模态框
      setShowTranslationAssistant(false);
    } catch (error) {
      logger.error('ChatDetailScreen', 'Error sending translation:', error);
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
  const renderMessage = ({ item }: { item: MessageInterface }) => {
    return (
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
            onError={(e) => logger.error('ChatDetailScreen', 'Avatar load error:', item.senderId, e.nativeEvent.error)}
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
            onError={(e) => logger.error('ChatDetailScreen', 'My avatar load error:', user?.id, e.nativeEvent.error)}
          />
        )}
      </View>
    );
  };

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