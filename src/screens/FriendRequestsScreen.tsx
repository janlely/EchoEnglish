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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { FriendRequestsScreenNavigationProp } from '../types/navigation';
import { API_CONFIG } from '../config/constants';
import { database } from '../database';
import AuthToken from '../database/models/AuthToken';

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

// 获取 Token
const getAuthToken = async (): Promise<string | null> => {
  try {
    const tokens = await database.collections.get<AuthToken>('auth_tokens').query().fetch();
    if (tokens.length > 0) {
      return tokens[0].accessToken;
    }
    return null;
  } catch (error) {
    console.error('[FriendRequests] Get token error:', error);
    return null;
  }
};

const FriendRequestsScreen = () => {
  const navigation = useNavigation<FriendRequestsScreenNavigationProp>();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // 每次页面聚焦时刷新数据
  useFocusEffect(
    React.useCallback(() => {
      fetchRequests();
    }, [])
  );

  const fetchRequests = async () => {
    setLoading(true);
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
        setRequests(data.data.requests);
      } else {
        Alert.alert('获取失败', data.error || '请稍后重试');
      }
    } catch (error: any) {
      Alert.alert('获取失败', error.message || '请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    Alert.alert(
      '确认',
      '确定要接受这个好友请求吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '确定',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              const response = await fetch(`${API_CONFIG.BASE_URL}/api/friends/requests/${requestId}/accept`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
              });

              const data: any = await response.json();

              if (response.ok && data.success) {
                Alert.alert('成功', '已添加为好友');
                fetchRequests();
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

  const handleReject = async (requestId: string) => {
    Alert.alert(
      '确认',
      '确定要拒绝这个好友请求吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '拒绝',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getAuthToken();
              const response = await fetch(`${API_CONFIG.BASE_URL}/api/friends/requests/${requestId}/reject`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
              });

              const data: any = await response.json();

              if (response.ok && data.success) {
                Alert.alert('已拒绝');
                fetchRequests();
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

  const renderItem = ({ item }: { item: FriendRequest }) => (
    <View style={styles.requestItem}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{item.sender.name.charAt(0)}</Text>
        </View>
      </View>
      <View style={styles.requestInfo}>
        <Text style={styles.senderName}>{item.sender.name}</Text>
        <Text style={styles.senderEmail}>{item.sender.email}</Text>
        {item.message && (
          <Text style={styles.message} numberOfLines={2}>
            {item.message}
          </Text>
        )}
        <Text style={styles.timestamp}>
          {new Date(item.createdAt).toLocaleString('zh-CN')}
        </Text>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAccept(item.id)}
        >
          <Text style={styles.acceptButtonText}>接受</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => handleReject(item.id)}
        >
          <Text style={styles.rejectButtonText}>拒绝</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
      {requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>暂无好友请求</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
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
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  requestItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  requestInfo: {
    marginBottom: 12,
  },
  senderName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  senderEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FriendRequestsScreen;
