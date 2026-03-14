import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Q } from '@nozbe/watermelondb';
import { Conversation, Friend, Group, Message } from '../database/models';
import { MainScreenNavigationProp } from '../types/navigation';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getConversationsWithUnread } from '../api/conversations';
import { syncContacts, getGroupInfo } from '../api/contacts';
import { getAvatarUrl } from '../utils/avatar';
import logger from '../utils/logger';
import BubbleMenu from '../components/BubbleMenu';
import ConversationActionMenu, { ConversationMenuAction } from '../components/ConversationActionMenu';
import { messageService } from '../services/MessageService';
import WebSocketService from '../services/WebSocketService';

// Define TypeScript interfaces
interface ChatSessionInterface {
  conversationId: string;
  type: 'direct' | 'group';
  targetId: string;
  name: string;
  avatar?: string;
  latestMessage?: string;
  timestamp?: string;
  unreadCount: number;
  isPinned?: boolean;
}

// Chat Session Item Component
const ChatSessionItem = ({
  session,
  onPress,
  onLongPress,
  onRef,
}: {
  session: ChatSessionInterface;
  onPress: (conversationId: string) => void;
  onLongPress?: () => void;
  onRef?: (ref: View | null) => void;
}) => {
  return (
    <TouchableOpacity
      ref={onRef}
      style={[styles.chatItemContainer, session.isPinned && styles.pinnedItem]}
      onPress={() => onPress(session.conversationId)}
      onLongPress={onLongPress}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: getAvatarUrl(session.avatar, 50) }}
          style={styles.avatar}
        />
      </View>

      {/* Chat Info */}
      <View style={styles.chatInfoContainer}>
        <View style={styles.topRow}>
          <View style={styles.nameRow}>
            {session.isPinned && <Text style={styles.pinIcon}>📌 </Text>}
            <Text style={styles.chatName}>{session.name}</Text>
          </View>
          {session.timestamp && (
            <Text style={styles.timestamp}>{session.timestamp}</Text>
          )}
        </View>

        <View style={styles.bottomRow}>
          <Text
            numberOfLines={1}
            style={styles.lastMessage}
          >
            {session.latestMessage || ''}
          </Text>
          {session.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{session.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Main Screen Component
const MainScreen = () => {
  const navigation = useNavigation<MainScreenNavigationProp>();
  const [chatSessions, setChatSessions] = useState<ChatSessionInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const menuButtonRef = useRef<View>(null);
  const database = useDatabase();

  // Conversation action menu state
  const [showConversationActionMenu, setShowConversationActionMenu] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversationIsPinned, setSelectedConversationIsPinned] = useState(false);
  const [anchorPosition, setAnchorPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const itemRefs = useRef<Map<string, View>>(new Map());

  /**
   * Sync conversations with unread messages from server
   */
  const syncConversations = React.useCallback(async () => {
    try {
      logger.info('MainScreen', 'Syncing conversations with unread from server...');

      // Get conversations with unread messages
      const conversations = await getConversationsWithUnread();
      logger.info('MainScreen', 'Synced', conversations.length, 'conversations with unread');

      if (!database) {
        logger.warn('MainScreen', 'Database not available, skipping local update');
        setLoading(false);
        return;
      }

      // Update local conversations table
      await database.write(async () => {
        for (const conv of conversations) {
          try {
            // Skip if conv is undefined or missing required fields
            if (!conv || !conv.conversationId) {
              logger.warn('MainScreen', 'Invalid conversation data:', conv);
              continue;
            }

            // 单聊时，如果本地没有好友信息，同步对方用户信息
            if (conv.type === 'direct' && conv.targetId) {
              const friends = await database.collections
                .get<Friend>('friends')
                .query(Q.where('friend_id', Q.eq(conv.targetId)))
                .fetch();

              if (friends.length === 0) {
                // 没有好友信息，调用 API 获取
                try {
                  const { getUserInfo } = await import('../api/user');
                  const userInfo = await getUserInfo(conv.targetId);

                  await database.collections.get<Friend>('friends').create((f: Friend) => {
                    f.friendId = userInfo.id || conv.targetId;
                    f.name = userInfo.name || 'Unknown';
                    f.avatarUrl = userInfo.avatarUrl || undefined;
                    f.email = userInfo.email || undefined;
                    f.isOnline = userInfo.isOnline || false;
                    f.createdAt = Date.now();
                    f.updatedAt = Date.now();
                  });

                  logger.info('MainScreen', 'Synced friend info:', conv.targetId);
                } catch (e) {
                  logger.warn('MainScreen', 'Failed to sync friend info:', conv.targetId, e);
                }
              }
            }

            // Update or create conversation
            const existingConversations = await database.collections
              .get<Conversation>('conversations')
              .query(Q.where('conversation_id', Q.eq(conv.conversationId)))
              .fetch();

            if (existingConversations.length > 0) {
              await existingConversations[0].update((c: Conversation) => {
                c.type = conv.type || 'direct';
                c.targetId = conv.targetId || '';
                c.unreadCount = conv.unreadCount || 0;
                c.latestSeq = conv.latestSeq || undefined;
                c.latestSummary = conv.latestSummary || undefined;
                c.latestSenderId = conv.latestSenderId || undefined;
                c.latestTimestamp = conv.latestTimestamp ? new Date(conv.latestTimestamp).getTime() : undefined;
                c.lastReadSeq = conv.lastReadSeq || undefined;
                c.updatedAt = Date.now();
              });
            } else {
              await database.collections.get<Conversation>('conversations').create((c: Conversation) => {
                c.conversationId = conv.conversationId;
                c.type = conv.type || 'direct';
                c.targetId = conv.targetId || '';
                c.unreadCount = conv.unreadCount || 0;
                c.latestSeq = conv.latestSeq || undefined;
                c.latestSummary = conv.latestSummary || undefined;
                c.latestSenderId = conv.latestSenderId || undefined;
                c.latestTimestamp = conv.latestTimestamp ? new Date(conv.latestTimestamp).getTime() : undefined;
                c.lastReadSeq = conv.lastReadSeq || undefined;
                c.createdAt = Date.now();
                c.updatedAt = Date.now();
              });
            }

            // For group chat, check if group info exists locally
            if (conv.type === 'group') {
              const existingGroups = await database.collections
                .get<Group>('groups')
                .query(Q.where('group_id', Q.eq(conv.targetId)))
                .fetch();

              if (existingGroups.length === 0) {
                // Group info not found locally, fetch from server
                try {
                  const groupInfo = await getGroupInfo(conv.targetId);
                  await database.collections.get<Group>('groups').create((g: Group) => {
                    g.groupId = groupInfo.id;
                    g.name = groupInfo.name;
                    g.avatarUrl = groupInfo.avatarUrl || undefined;
                    g.ownerId = groupInfo.ownerId;
                    g.memberIds = JSON.stringify(groupInfo.members?.map(m => m.userId) || []);
                    g.createdAt = Date.now();
                    g.updatedAt = Date.now();
                  });
                  logger.debug('MainScreen', 'Fetched and saved group info:', groupInfo.id);
                } catch (e) {
                  logger.error('MainScreen', 'Failed to fetch group info:', conv.targetId, e);
                }
              }
            }
          } catch (e) {
            logger.error('MainScreen', 'Error updating conversation:', conv.conversationId, e);
          }
        }
      });

      logger.info('MainScreen', 'Local conversations updated');
    } catch (error) {
      logger.error('MainScreen', 'Sync conversations error:', error);
    } finally {
      setLoading(false);
    }
  }, [database]);

  /**
   * Load chat sessions from local database with friend/group info
   */
  const loadChatSessionsFromLocal = React.useCallback(async () => {
    if (!database) {
      logger.warn('MainScreen', 'Database not available for loading');
      setChatSessions([]);
      return;
    }

    try {
      logger.info('MainScreen', 'Loading sessions from local database...');

      // Get all conversations
      const conversations = await database.collections
        .get<Conversation>('conversations')
        .query(Q.sortBy('updated_at', Q.desc))
        .fetch();

      logger.info('MainScreen', 'Loaded', conversations.length, 'conversations from local');

      // Load sessions with friend/group info
      const formattedSessions = await Promise.all(
        conversations.map(async (conv) => {
          let name = 'Chat';
          let avatar: string | undefined;

          logger.info('MainScreen', 'Processing conversation:', {
            conversationId: conv.conversationId,
            type: conv.type,
            targetId: conv.targetId,
            latestSummary: conv.latestSummary,
          });

          if (conv.type === 'direct') {
            // Get friend info
            const friends = await database.collections
              .get<Friend>('friends')
              .query(Q.where('friend_id', Q.eq(conv.targetId)))
              .fetch();
            logger.info('MainScreen', 'Found', friends.length, 'friends for targetId:', conv.targetId);
            if (friends.length > 0) {
              name = friends[0].name;
              avatar = friends[0].avatarUrl;
            } else {
              logger.warn('MainScreen', 'No friend info for:', conv.targetId);
            }
          } else {
            // Get group info
            logger.debug('MainScreen', 'Loading group info for targetId:', conv.targetId);
            const groups = await database.collections
              .get<Group>('groups')
              .query(Q.where('group_id', Q.eq(conv.targetId)))
              .fetch();
            logger.debug('MainScreen', 'Found', groups.length, 'groups for targetId:', conv.targetId);
            if (groups.length > 0) {
              name = groups[0].name;
              avatar = groups[0].avatarUrl;
              logger.debug('MainScreen', 'Group name:', name);
            } else {
              logger.warn('MainScreen', 'Group not found for targetId:', conv.targetId, 'conversationId:', conv.conversationId);
            }
          }

          return {
            conversationId: conv.conversationId,
            type: conv.type as 'direct' | 'group',
            targetId: conv.targetId,
            name,
            avatar,
            latestMessage: conv.latestSummary,
            timestamp: conv.latestTimestamp
              ? new Date(conv.latestTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : undefined,
            unreadCount: conv.unreadCount || 0,
            isPinned: conv.isPinned || false,
          };
        })
      );

      // Sort: pinned first, then by updated_at (timestamp)
      formattedSessions.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0; // Keep original order (already sorted by updated_at)
      });

      setChatSessions(formattedSessions);
    } catch (error: any) {
      logger.error('MainScreen', 'Load local sessions error:', error.message);
      setChatSessions([]);
    }
  }, [database]);

  useEffect(() => {
    // 设置页面标题和自定义头部
    navigation.setOptions({
      headerShown: true,
      headerStyle: {
        backgroundColor: '#f8f8f8',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
      },
      headerTitle: 'EchoEnglish',
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: 'bold',
      },
      headerRight: () => (
        <TouchableOpacity
          ref={menuButtonRef}
          style={{ paddingRight: 16 }}
          onPress={() => setMenuVisible(true)}
        >
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#007AFF' }}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    // Initial sync and load (only if database is available)
    const init = async () => {
      if (!database) {
        logger.warn('MainScreen', 'Database not ready, skipping initial sync');
        setLoading(false);
        return;
      }
      await syncConversations();
      await loadChatSessionsFromLocal();
    };
    init();
  }, [database, syncConversations, loadChatSessionsFromLocal]);

  // Set up conversation update listener from MessageService
  // This is triggered after db.write transaction completes, ensuring data is ready
  useEffect(() => {
    if (!database) {
      logger.warn('MainScreen', 'Database not available for listener');
      return;
    }

    logger.info('MainScreen', 'Setting up conversation update listener from MessageService...');

    // Load initial data first
    loadChatSessionsFromLocal().then(() => {
      logger.info('MainScreen', 'Initial sessions loaded');
    });

    // Subscribe to conversation update events from MessageService
    // This is triggered after saveMessageAndUpdateConversation completes
    const unsubscribe = messageService.onConversationUpdate(() => {
      logger.info('MainScreen', '🔔 Conversation update event received, reloading sessions');
      loadChatSessionsFromLocal();
    });

    logger.info('MainScreen', 'Conversation update listener created');

    return () => {
      logger.info('MainScreen', 'Cleaning up conversation update listener');
      unsubscribe();
    };
  }, [database, loadChatSessionsFromLocal]);

  // Refresh when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (!database) {
        logger.warn('MainScreen', 'Database not ready, skipping focus sync');
        return;
      }
      logger.info('MainScreen', 'Screen focused, syncing conversations...');
      syncConversations().then(() => {
        loadChatSessionsFromLocal();
      });
    }, [database, syncConversations, loadChatSessionsFromLocal])
  );

  const handleChatPress = (conversationId: string) => {
    // Find the session that was pressed
    const session = chatSessions.find(s => s.conversationId === conversationId);
    if (session) {
      // Navigate to chat detail screen
      // For direct chat, pass targetId as chatId; for group chat, pass groupId
      navigation.navigate('ChatDetail', {
        chatId: session.targetId,
        chatName: session.name,
        chatType: session.type,
      });
    }
  };

  /**
   * Handle conversation item long press
   */
  const handleConversationLongPress = (conversationId: string) => {
    const session = chatSessions.find(s => s.conversationId === conversationId);
    if (!session) return;

    setSelectedConversationId(conversationId);
    setSelectedConversationIsPinned(session.isPinned || false);

    // Get the ref from map and measure position
    const ref = itemRefs.current.get(conversationId) || null;
    if (ref) {
      ref.measureInWindow((x, y, width, height) => {
        setAnchorPosition({ x, y, width, height });
      });
    }

    setShowConversationActionMenu(true);
  };

  /**
   * Handle conversation menu action
   */
  const handleConversationAction = (action: ConversationMenuAction) => {
    if (!selectedConversationId || !database) return;

    // Close menu first
    setShowConversationActionMenu(false);

    if (action === 'pin' || action === 'unpin') {
      // Update pin status
      database.write(async () => {
        const conversations = await database.collections
          .get<Conversation>('conversations')
          .query(Q.where('conversation_id', Q.eq(selectedConversationId)))
          .fetch();

        if (conversations.length > 0) {
          await conversations[0].update((c: Conversation) => {
            c.isPinned = action === 'pin';
            c.updatedAt = Date.now();
          });
          logger.info('MainScreen', action === 'pin' ? 'Pinned conversation' : 'Unpinned conversation', selectedConversationId);
          await loadChatSessionsFromLocal();
        }
      }).catch((error) => {
        logger.error('MainScreen', 'Failed to update pin status:', error);
        Alert.alert('错误', '操作失败，请重试');
      });
      setSelectedConversationId(null);
      setAnchorPosition(null);
    } else if (action === 'delete') {
      Alert.alert(
        '删除聊天',
        `确定要删除与 ${chatSessions.find(s => s.conversationId === selectedConversationId)?.name} 的聊天记录吗？`,
        [
          {
            text: '取消',
            style: 'cancel',
            onPress: () => {
              setSelectedConversationId(null);
              setAnchorPosition(null);
            },
          },
          {
            text: '删除',
            style: 'destructive',
            onPress: async () => {
              try {
                // Step 1: 调用 markRead 清除后端的 unreadCount（失败不影响本地删除）
                const session = chatSessions.find(s => s.conversationId === selectedConversationId);
                if (session && session.unreadCount > 0) {
                  try {
                    // 使用 WebSocket mark_read 事件清除后端未读状态
                    WebSocketService.markRead(
                      selectedConversationId,
                      selectedConversationId,
                      session.type
                    );
                    logger.info('MainScreen', 'Called markRead for conversation:', selectedConversationId);
                  } catch (markReadError) {
                    // markRead 失败不影响本地删除，记录日志即可
                    logger.warn('MainScreen', 'Failed to call markRead (will still delete locally):', selectedConversationId, markReadError);
                  }
                }

                // Step 2: 删除本地数据
                await database.write(async () => {
                  // Delete all messages for this conversation
                  const messages = await database.collections
                    .get<Message>('messages')
                    .query(Q.where('conversation_id', Q.eq(selectedConversationId)))
                    .fetch();

                  for (const msg of messages) {
                    await msg.destroyPermanently();
                  }

                  // Delete the conversation record
                  const conversations = await database.collections
                    .get<Conversation>('conversations')
                    .query(Q.where('conversation_id', Q.eq(selectedConversationId)))
                    .fetch();

                  for (const conv of conversations) {
                    await conv.destroyPermanently();
                  }
                });

                logger.info('MainScreen', 'Deleted conversation and messages:', selectedConversationId);
                await loadChatSessionsFromLocal();
              } catch (error) {
                logger.error('MainScreen', 'Failed to delete conversation:', error);
                Alert.alert('错误', '删除失败，请重试');
              } finally {
                setSelectedConversationId(null);
                setAnchorPosition(null);
              }
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  const renderChatItem = ({ item }: { item: ChatSessionInterface }) => (
    <ChatSessionItem
      session={item}
      onPress={handleChatPress}
      onLongPress={() => handleConversationLongPress(item.conversationId)}
      onRef={(ref) => {
        if (ref) {
          itemRefs.current.set(item.conversationId, ref);
        } else {
          itemRefs.current.delete(item.conversationId);
        }
      }}
    />
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading chats...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={chatSessions}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.conversationId}
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Bubble Menu */}
      <BubbleMenu
        isVisible={menuVisible}
        onClose={() => setMenuVisible(false)}
        fromRef={menuButtonRef}
        showArrow={true}
        placement="bottom"
        offset={-10}
        items={[
          {
            id: 'add-friend',
            label: '👤 添加好友',
            onPress: () => navigation.navigate('SearchUser'),
          },
          {
            id: 'create-group',
            label: '👥 创建群聊',
            onPress: () => navigation.navigate('CreateGroupChat'),
          },
        ]}
      />

      {/* Conversation Action Menu */}
      {showConversationActionMenu && selectedConversationId && (
        <ConversationActionMenu
          visible={showConversationActionMenu}
          conversationId={selectedConversationId}
          isPinned={selectedConversationIsPinned}
          onPress={handleConversationAction}
          onClose={() => {
            setSelectedConversationId(null);
            setAnchorPosition(null);
          }}
          anchorRef={itemRefs.current.has(selectedConversationId) ? { current: itemRefs.current.get(selectedConversationId) } : undefined}
          anchorPosition={anchorPosition || undefined}
        />
      )}
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  chatItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pinnedItem: {
    backgroundColor: '#f0f7ff',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4caf50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatInfoContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinIcon: {
    fontSize: 14,
  },
  chatName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#888',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default MainScreen;