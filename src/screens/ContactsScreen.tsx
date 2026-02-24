import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { API_CONFIG } from '../config/constants';
import { database } from '../database';
import AuthToken from '../database/models/AuthToken';
import ChatSession from '../database/models/ChatSession';
import { FriendRequestsScreenNavigationProp } from '../types/navigation';

interface FriendRequest {
  id: string;
  sender: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  message?: string;
  createdAt: string;
}

interface Friend {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

// 获取 Token
const getAuthToken = async (): Promise<string | null> => {
  try {
    const tokens = await database.collections.get<AuthToken>('auth_tokens').query().fetch();
    if (tokens.length > 0) {
      return tokens[0].accessToken;
    }
    return null;
  } catch (error) {
    console.error('[Contacts] Get token error:', error);
    return null;
  }
};

// 好友请求项组件
const FriendRequestItem = ({
  request,
  onPress,
  onAccept,
  onReject,
}: {
  request: FriendRequest;
  onPress: () => void;
  onAccept: (id: string, sender: any) => void;
  onReject: (id: string) => void;
}) => (
  <TouchableOpacity style={styles.requestItem} onPress={onPress}>
    <View style={styles.requestAvatar}>
      <Text style={styles.requestAvatarText}>
        {request.sender.name.charAt(0).toUpperCase()}
      </Text>
    </View>
    <View style={styles.requestInfo}>
      <Text style={styles.requestName}>{request.sender.name}</Text>
      {request.message && (
        <Text style={styles.requestMessage} numberOfLines={1}>
          {request.message}
        </Text>
      )}
      <Text style={styles.requestTime}>
        {new Date(request.createdAt).toLocaleDateString('zh-CN')}
      </Text>
    </View>
    <View style={styles.requestActions}>
      <TouchableOpacity
        style={styles.acceptButton}
        onPress={(e) => {
          e.stopPropagation();
          onAccept(request.id, request.sender);
        }}
      >
        <Text style={styles.acceptButtonText}>接受</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.rejectButton}
        onPress={(e) => {
          e.stopPropagation();
          onReject(request.id);
        }}
      >
        <Text style={styles.rejectButtonText}>拒绝</Text>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
);

// 好友项组件
const FriendItem = ({
  friend,
  onPress,
}: {
  friend: Friend;
  onPress: (friend: Friend) => void;
}) => (
  <TouchableOpacity style={styles.friendItem} onPress={() => onPress(friend)}>
    <View style={styles.friendAvatar}>
      <Text style={styles.friendAvatarText}>
        {friend.name.charAt(0).toUpperCase()}
      </Text>
    </View>
    <View style={styles.friendInfo}>
      <Text style={styles.friendName}>{friend.name}</Text>
      <Text style={styles.friendEmail}>{friend.email}</Text>
    </View>
    {friend.isOnline && <View style={styles.onlineIndicator} />}
  </TouchableOpacity>
);

const ContactsScreen = () => {
  const navigation = useNavigation<FriendRequestsScreenNavigationProp>();
  const db = useDatabase();
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [expandedNewFriends, setExpandedNewFriends] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  // 创建会话并跳转到聊天页面
  const handleFriendPress = async (friend: Friend) => {
    console.log('[Contacts] handleFriendPress called, friend:', friend);
    try {
      const token = await getAuthToken();
      
      // 检查会话是否已存在
      const existingSessions = await db.collections
        .get<ChatSession>('chat_sessions')
        .query()
        .fetch();

      let session = existingSessions.find((s: any) => s.targetId === friend.id);

      if (!session) {
        // 创建新会话
        session = await db.write(async () => {
          return await db.collections.get<ChatSession>('chat_sessions').create((s: any) => {
            s.targetId = friend.id;
            s.chatType = 'direct';
            s.name = friend.name;
            s.avatarUrl = friend.avatarUrl;
            s.unreadCount = 0;
            s.isOnline = friend.isOnline;
          });
        });
        console.log('[Contacts] Created chat session for friend:', friend.name);
      }

      // 跳转到聊天页面，传递好友 ID 而不是会话 ID
      navigation.navigate('ChatDetail', {
        chatId: friend.id, // 使用好友 ID，后端用它来检查好友关系
        chatName: friend.name,
        chatType: 'direct', // 私聊
      });
    } catch (error: any) {
      console.error('[Contacts] Handle friend press error:', error);
      Alert.alert('错误', '无法打开聊天：' + error.message);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchFriendRequests(),
        fetchFriends(),
      ]);
    } catch (error) {
      console.error('[Contacts] Fetch data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/friends/requests`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data: any = await response.json();
      if (response.ok && data.success) {
        setFriendRequests(data.data.requests);
      }
    } catch (error) {
      console.error('[Contacts] Fetch requests error:', error);
    }
  };

  const fetchFriends = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/friends/list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data: any = await response.json();
      console.log('[Contacts] fetchFriends response:', data);
      if (response.ok && data.success) {
        console.log('[Contacts] fetchFriends friends:', data.data.friends);
        setFriends(data.data.friends);
      }
    } catch (error) {
      console.error('[Contacts] Fetch friends error:', error);
    }
  };

  const handleAcceptRequest = async (requestId: string, sender: any) => {
    Alert.alert(
      '确认',
      '确定要接受这个好友请求吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              const response = await fetch(
                `${API_CONFIG.BASE_URL}/api/friends/requests/${requestId}/accept`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                }
              );

              const data: any = await response.json();
              if (response.ok && data.success) {
                // 创建会话
                await db.write(async () => {
                  await db.collections.get<ChatSession>('chat_sessions').create((s: any) => {
                    s.targetId = sender.id;
                    s.chatType = 'direct';
                    s.name = sender.name;
                    s.avatarUrl = sender.avatarUrl;
                    s.unreadCount = 0;
                  });
                });

                Alert.alert('成功', '已添加为好友，可以在消息中聊天了');
                fetchData(); // 刷新数据
              } else {
                Alert.alert('失败', data.error || '请稍后重试');
              }
            } catch (error: any) {
              Alert.alert('失败', error.message || '请稍后重试');
            }
          },
        },
      ]
    );
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/api/friends/requests/${requestId}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      const data: any = await response.json();
      if (response.ok && data.success) {
        fetchData(); // 刷新数据
      } else {
        Alert.alert('失败', data.error || '请稍后重试');
      }
    } catch (error: any) {
      Alert.alert('失败', error.message || '请稍后重试');
    }
  };

  // 构建列表数据
  const renderListData = () => {
    const data: any[] = [];

    // 新的好友项
    data.push({
      type: 'newFriends',
      key: 'newFriends',
      count: friendRequests.length,
    });

    // 如果展开，添加好友请求列表
    if (expandedNewFriends && friendRequests.length > 0) {
      friendRequests.forEach((request) => {
        data.push({
          type: 'friendRequest',
          key: `request-${request.id}`,
          request,
        });
      });
    }

    // 已添加的好友
    if (friends.length > 0) {
      data.push({
        type: 'friendsHeader',
        key: 'friendsHeader',
        count: friends.length,
      });

      friends.forEach((friend) => {
        data.push({
          type: 'friend',
          key: `friend-${friend.id}`,
          friend,
        });
      });
    }

    return data;
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item.type === 'newFriends') {
      return (
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setExpandedNewFriends(!expandedNewFriends)}
        >
          <Text style={styles.sectionHeaderText}>新的好友</Text>
          <View style={styles.badgeContainer}>
            {item.count > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.count}</Text>
              </View>
            )}
            <Text style={styles.expandIcon}>
              {expandedNewFriends ? '∧' : '∨'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (item.type === 'friendRequest') {
      return (
        <FriendRequestItem
          request={item.request}
          onPress={() => navigation.navigate('FriendRequests')}
          onAccept={handleAcceptRequest}
          onReject={handleRejectRequest}
        />
      );
    }

    if (item.type === 'friendsHeader') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>
            已添加的好友 ({item.count})
          </Text>
        </View>
      );
    }

    if (item.type === 'friend') {
      return <FriendItem friend={item.friend} onPress={handleFriendPress} />;
    }

    return null;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={renderListData()}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#999',
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 6,
  },
  expandIcon: {
    fontSize: 16,
    color: '#999',
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  requestAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  requestMessage: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  requestTime: {
    fontSize: 12,
    color: '#999',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#34C759',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  rejectButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    position: 'relative',
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  friendEmail: {
    fontSize: 13,
    color: '#666',
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#fff',
  },
});

export default ContactsScreen;
