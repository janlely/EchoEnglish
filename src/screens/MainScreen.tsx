import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Q } from '@nozbe/watermelondb';
import { Conversation, Friend, Group } from '../database/models';
import { MainScreenNavigationProp } from '../types/navigation';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getConversationsWithUnread } from '../api/conversations';
import { syncContacts, getGroupInfo } from '../api/contacts';
import { getAvatarUrl } from '../utils/avatar';
import logger from '../utils/logger';

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
  latestMsgId?: string;
}

// Chat Session Item Component
const ChatSessionItem = ({
  session,
  onPress
}: {
  session: ChatSessionInterface;
  onPress: (conversationId: string) => void
}) => {
  return (
    <TouchableOpacity
      style={styles.chatItemContainer}
      onPress={() => onPress(session.conversationId)}
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
          <Text style={styles.chatName}>{session.name}</Text>
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
  const database = useDatabase();

  /**
   * Sync conversations with unread messages from server
   */
  const syncConversations = React.useCallback(async () => {
    try {
      console.log('[MainScreen] Syncing conversations with unread from server...');

      // Get conversations with unread messages
      const conversations = await getConversationsWithUnread();
      console.log('[MainScreen] Synced', conversations.length, 'conversations with unread');

      if (!database) {
        console.log('[MainScreen] Database not available, skipping local update');
        setLoading(false);
        return;
      }

      // Update local conversations table
      await database.write(async () => {
        for (const conv of conversations) {
          try {
            // Update or create conversation
            const existingConversations = await database.collections
              .get<Conversation>('conversations')
              .query(Q.where('conversation_id', Q.eq(conv.conversationId)))
              .fetch();

            if (existingConversations.length > 0) {
              await existingConversations[0].update((c: Conversation) => {
                c.type = conv.type;
                c.targetId = conv.targetId;
                c.unreadCount = conv.unreadCount;
                c.latestMsgId = conv.lastReadMsgId || undefined;
                c.updatedAt = Date.now();
              });
            } else {
              await database.collections.get<Conversation>('conversations').create((c: Conversation) => {
                c.conversationId = conv.conversationId;
                c.type = conv.type;
                c.targetId = conv.targetId;
                c.unreadCount = conv.unreadCount;
                c.latestMsgId = conv.lastReadMsgId || undefined;
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
            console.log('[MainScreen] Error updating conversation:', conv.conversationId, e);
          }
        }
      });

      console.log('[MainScreen] Local conversations updated');
    } catch (error) {
      console.error('[MainScreen] Sync conversations error:', error);
    } finally {
      setLoading(false);
    }
  }, [database]);

  /**
   * Load chat sessions from local database with friend/group info
   */
  const loadChatSessionsFromLocal = React.useCallback(async () => {
    if (!database) {
      console.log('[MainScreen] Database not available for loading');
      setChatSessions([]);
      return;
    }

    try {
      console.log('[MainScreen] Loading sessions from local database...');

      // Get all conversations
      const conversations = await database.collections
        .get<Conversation>('conversations')
        .query(Q.sortBy('updated_at', Q.desc))
        .fetch();

      console.log('[MainScreen] Loaded', conversations.length, 'conversations from local');

      // Load sessions with friend/group info
      const formattedSessions = await Promise.all(
        conversations.map(async (conv) => {
          let name = 'Chat';
          let avatar: string | undefined;

          if (conv.type === 'direct') {
            // Get friend info
            const friends = await database.collections
              .get<Friend>('friends')
              .query(Q.where('friend_id', Q.eq(conv.targetId)))
              .fetch();
            if (friends.length > 0) {
              name = friends[0].name;
              avatar = friends[0].avatarUrl;
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
            latestMsgId: conv.latestMsgId,
          };
        })
      );

      setChatSessions(formattedSessions);
    } catch (error: any) {
      console.error('[MainScreen] Load local sessions error:', error.message);
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
        <View style={{ position: 'relative' }}>
          <TouchableOpacity
            style={{ paddingRight: 16 }}
            onPress={() => setMenuVisible(true)}
          >
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#007AFF' }}>+</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    // Initial sync and load (only if database is available)
    const init = async () => {
      if (!database) {
        console.log('[MainScreen] Database not ready, skipping initial sync');
        setLoading(false);
        return;
      }
      await syncConversations();
      await loadChatSessionsFromLocal();
    };
    init();
  }, [database, syncConversations, loadChatSessionsFromLocal]);

  // Refresh when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (!database) {
        console.log('[MainScreen] Database not ready, skipping focus sync');
        return;
      }
      console.log('[MainScreen] Screen focused, syncing conversations...');
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

  const renderChatItem = ({ item }: { item: ChatSessionInterface }) => (
    <ChatSessionItem
      session={item}
      onPress={handleChatPress}
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

      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate('SearchUser');
              }}
            >
              <Text style={styles.menuItemText}>👤 添加好友</Text>
            </TouchableOpacity>
            <View style={styles.menuSeparator} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate('CreateGroupChat');
              }}
            >
              <Text style={styles.menuItemText}>👥 创建群聊</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    width: '50%',
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  menuSeparator: {
    height: 1,
    backgroundColor: '#e0e0e0',
  },
});

export default MainScreen;