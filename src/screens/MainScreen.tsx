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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Q } from '@nozbe/watermelondb';
import { ChatSession } from '../database/models';

// Define TypeScript interfaces
interface ChatSessionInterface {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount?: number;
  avatar?: string;
  isOnline?: boolean;
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
      onPress={() => onPress(session.id)}
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
const MainScreen = ({ navigation }: any) => {
  const database = useDatabase();
  const [chatSessions, setChatSessions] = useState<ChatSessionInterface[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch chat sessions from the database
    const fetchChatSessions = async () => {
      try {
        if (!database) {
          console.error('Database is not available');
          return;
        }
        
        const sessions = await database.collections
          .get<ChatSession>('chat_sessions')
          .query()
          .fetch();

        // Convert database records to the format expected by the UI
        const formattedSessions = sessions.map(session => ({
          id: session.id,
          name: session.name,
          lastMessage: 'Loading...', // We'll fetch the actual last message later
          timestamp: new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unreadCount: session.unreadCount,
          avatar: session.avatarUrl,
          isOnline: true, // We'll determine this based on user status
        }));

        setChatSessions(formattedSessions);
      } catch (error) {
        console.error('Error fetching chat sessions:', error);
      } finally {
        setLoading(false);
      }
    };

    if (database) {
      fetchChatSessions();

      // Set up a subscription to listen for changes in the database
      const subscription = database.collections
        .get<ChatSession>('chat_sessions')
        .query()
        .observe()
        .subscribe((sessions) => {
          const formattedSessions = sessions.map(session => ({
            id: session.id,
            name: session.name,
            lastMessage: 'Loading...', // We'll fetch the actual last message later
            timestamp: new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            unreadCount: session.unreadCount,
            avatar: session.avatarUrl,
            isOnline: true, // We'll determine this based on user status
          }));
          
          setChatSessions(formattedSessions);
        });

      // Clean up subscription when component unmounts
      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }
  }, [database]);

  const handleChatPress = (sessionId: string) => {
    // Find the session that was pressed
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      // Navigate to chat detail screen with session info
      navigation.navigate('ChatDetail', {
        chatId: sessionId,
        chatName: session.name,
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading chats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />

      {/* Chat Sessions List */}
      <FlatList
        data={chatSessions}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
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