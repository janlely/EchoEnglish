import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Q } from '@nozbe/watermelondb';
import { ChatSession } from '../database/models';
import { MainScreenNavigationProp } from '../types/navigation';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { API_CONFIG } from '../config/constants';
import { getAuthToken } from '../services/ApiService';

// Define TypeScript interfaces
interface ChatSessionInterface {
  id: string;
  targetId: string;
  chatType: 'direct' | 'group';
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount?: number;
  avatar?: string;
  isOnline?: boolean;
  lastMessageId?: string;
}

// Chat Session Item Component
const ChatSessionItem = ({
  session,
  onPress
}: {
  session: ChatSessionInterface;
  onPress: (id: string) => void
}) => {
  return (
    <TouchableOpacity
      style={styles.chatItemContainer}
      onPress={() => onPress(session.targetId)}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: session.avatar || 'https://placehold.co/50x50' }}
          style={styles.avatar}
        />
        {session.isOnline && <View style={styles.onlineIndicator} />}
      </View>

      {/* Chat Info */}
      <View style={styles.chatInfoContainer}>
        <View style={styles.topRow}>
          <Text style={styles.chatName}>{session.name}</Text>
          <Text style={styles.timestamp}>{session.timestamp}</Text>
        </View>

        <View style={styles.bottomRow}>
          <Text
            numberOfLines={1}
            style={styles.lastMessage}
          >
            {session.lastMessage}
          </Text>
          {session.unreadCount !== undefined && session.unreadCount > 0 && (
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
  const database = useDatabase();
  const [chatSessions, setChatSessions] = useState<ChatSessionInterface[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync chat sessions from server and update local database
  const syncChatSessions = React.useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        console.log('[MainScreen] No token, skip sync');
        setLoading(false);
        return;
      }

      console.log('[MainScreen] Syncing sessions from server...');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/chats/sessions/sync`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data: any = await response.json();

      if (response.ok && data.success) {
        console.log('[MainScreen] Synced', data.data.sessions.length, 'sessions');
        
        // Update local database
        if (!database) {
          console.log('[MainScreen] Database not available');
          setLoading(false);
          return;
        }

        await database.write(async () => {
          for (const session of data.data.sessions) {
            try {
              console.log('[MainScreen] Processing session:', {
                targetId: session.targetId,
                name: session.name,
                chatType: session.chatType,
                lastMessage: session.lastMessage?.text,
              });
              
              // Check if session exists
              const existing = await database.collections
                .get<ChatSession>('chat_sessions')
                .query(Q.where('target_id', Q.eq(session.targetId)))
                .fetch();

              if (existing.length > 0) {
                // Update existing session
                await existing[0].update((s: any) => {
                  s.unreadCount = session.unreadCount;
                  s.lastMessageId = session.lastMessage?.msgId || null;
                  s.lastMessageText = session.lastMessage?.text || '';
                  s.lastMessageTime = session.lastMessage?.timestamp
                    ? new Date(session.lastMessage.timestamp).getTime()
                    : Date.now();
                  s.chatType = session.chatType;
                  s.name = session.name || s.name; // Use server-provided name
                  s.avatarUrl = session.avatarUrl || s.avatarUrl;
                });
              } else {
                // Create new session
                await database.collections.get<ChatSession>('chat_sessions').create((s: any) => {
                  s.targetId = session.targetId;
                  s.chatType = session.chatType;
                  s.name = session.name || (session.chatType === 'direct' ? 'Chat' : 'Group');
                  s.avatarUrl = session.avatarUrl;
                  s.unreadCount = session.unreadCount;
                  s.lastMessageId = session.lastMessage?.msgId || null;
                  s.lastMessageText = session.lastMessage?.text || '';
                  s.lastMessageTime = session.lastMessage?.timestamp
                    ? new Date(session.lastMessage.timestamp).getTime()
                    : Date.now();
                });
              }
            } catch (e) {
              console.log('[MainScreen] Error updating session:', session.targetId, e);
            }
          }
        });

        console.log('[MainScreen] Local database updated');
      } else {
        console.error('[MainScreen] Sync failed:', data.error);
      }
    } catch (error) {
      console.error('[MainScreen] Sync error:', error);
    } finally {
      setLoading(false);
    }
  }, [database]);

  // Load chat sessions from local database
  const loadChatSessionsFromLocal = React.useCallback(async () => {
    if (!database) {
      console.log('[MainScreen] Database not available for loading');
      return;
    }

    try {
      console.log('[MainScreen] Loading sessions from local database...');
      
      // First, check the table structure
      const chatSessionsCollection = database.collections.get<ChatSession>('chat_sessions');
      console.log('[MainScreen] Chat sessions collection:', chatSessionsCollection);
      
      const sessions = await database.collections
        .get<ChatSession>('chat_sessions')
        .query(
          // Q.sortBy('last_message_time', Q.desc)
        )
        .fetch();

      console.log('[MainScreen] Loaded', sessions.length, 'sessions from local');

      const formattedSessions = sessions.map(session => ({
        id: session.id,
        targetId: session.targetId,
        chatType: session.chatType as 'direct' | 'group',
        name: session.name,
        lastMessage: session.lastMessageText || '',
        timestamp: session.lastMessageTime
          ? new Date(session.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '',
        unreadCount: session.unreadCount,
        avatar: session.avatarUrl,
        isOnline: session.isOnline,
        lastMessageId: session.lastMessageId,
      }));

      setChatSessions(formattedSessions);
    } catch (error: any) {
      console.error('[MainScreen] Load local sessions error:', error.message);
      console.error('[MainScreen] Error stack:', error.stack);
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
          style={{ paddingRight: 16 }}
          onPress={() => navigation.navigate('SearchUser')}
        >
          <Text style={{ fontSize: 20 }}>+</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    // Initial sync and load
    const init = async () => {
      await syncChatSessions();
      await loadChatSessionsFromLocal();
    };
    init();
  }, []);

  // Refresh when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      console.log('[MainScreen] Screen focused, syncing sessions...');
      syncChatSessions().then(() => {
        loadChatSessionsFromLocal();
      });
    }, [syncChatSessions, loadChatSessionsFromLocal])
  );

  const handleChatPress = (targetId: string) => {
    // Find the session that was pressed
    const session = chatSessions.find(s => s.targetId === targetId);
    if (session) {
      // Navigate to chat detail screen
      navigation.navigate('ChatDetail', {
        chatId: session.targetId,
        chatName: session.name,
        chatType: session.chatType,
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
    <FlatList
      data={chatSessions}
      renderItem={renderChatItem}
      keyExtractor={(item) => item.id}
      style={styles.listContainer}
      showsVerticalScrollIndicator={false}
    />
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
});

export default MainScreen;