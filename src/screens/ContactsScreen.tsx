import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Q } from '@nozbe/watermelondb';
import { syncContacts, getFriends, getGroups } from '../api/contacts';
import { Friend, Group, SyncCursor } from '../database/models';
import { ChatDetailScreenNavigationProp, ContactsScreenNavigationProp } from '../types/navigation';
import { TokenStorage } from '../services/TokenStorage';
import { getAvatarUrl } from '../utils/avatar';
import { API_CONFIG } from '../config/constants';

interface FriendItem {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
}

interface GroupItem {
  id: string;
  name: string;
  avatarUrl?: string | null;
  memberCount: number;
}

interface FriendRequestItem {
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

// 折叠列表头组件
const SectionHeader = ({
  title,
  count,
  expanded,
  onPress,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.sectionHeader} onPress={onPress}>
    <Text style={styles.sectionHeaderTitle}>{title}</Text>
    <View style={styles.sectionHeaderRight}>
      <Text style={styles.sectionHeaderCount}>{count}</Text>
      <Text style={[styles.sectionHeaderArrow, expanded && styles.sectionHeaderArrowExpanded]}>
        ›
      </Text>
    </View>
  </TouchableOpacity>
);

// 好友申请项组件
const FriendRequestItemComponent = ({
  request,
  onAccept,
  onReject,
}: {
  request: FriendRequestItem;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) => (
  <View style={styles.requestItem}>
    <View style={styles.requestInfo}>
      <Text style={styles.requestSender}>{request.sender.name}</Text>
      <Text style={styles.requestEmail}>{request.sender.email}</Text>
      {request.message && (
        <Text style={styles.requestMessage} numberOfLines={2}>
          {request.message}
        </Text>
      )}
      <Text style={styles.requestTime}>
        {new Date(request.createdAt).toLocaleString('zh-CN')}
      </Text>
    </View>
    <View style={styles.requestButtons}>
      <TouchableOpacity
        style={[styles.requestButton, styles.acceptButton]}
        onPress={() => onAccept(request.id)}
      >
        <Text style={styles.acceptButtonText}>接受</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.requestButton, styles.rejectButton]}
        onPress={() => onReject(request.id)}
      >
        <Text style={styles.rejectButtonText}>拒绝</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// 好友项组件
const FriendItemComponent = ({
  friend,
  onPress,
}: {
  friend: FriendItem;
  onPress: (friend: FriendItem) => void;
}) => (
  <TouchableOpacity style={styles.friendItem} onPress={() => onPress(friend)}>
    <Image
      source={{ uri: getAvatarUrl(friend.avatarUrl, 44) }}
      style={styles.friendAvatar}
    />
    <View style={styles.friendInfo}>
      <Text style={styles.friendName}>{friend.name}</Text>
      {friend.email && (
        <Text style={styles.friendEmail}>{friend.email}</Text>
      )}
    </View>
    {friend.isOnline && <View style={styles.onlineIndicator} />}
  </TouchableOpacity>
);

// 群组项组件
const GroupItemComponent = ({
  group,
  onPress,
}: {
  group: GroupItem;
  onPress: (group: GroupItem) => void;
}) => (
  <TouchableOpacity style={styles.friendItem} onPress={() => onPress(group)}>
    <Image
      source={{ uri: getAvatarUrl(group.avatarUrl, 44) }}
      style={styles.friendAvatar}
    />
    <View style={styles.friendInfo}>
      <Text style={styles.friendName}>{group.name}</Text>
      <Text style={styles.friendEmail}>{group.memberCount} 成员</Text>
    </View>
  </TouchableOpacity>
);

const ContactsScreen = () => {
  const navigation = useNavigation<ContactsScreenNavigationProp>();
  const db = useDatabase();
  
  // 数据状态
  const [friendRequests, setFriendRequests] = useState<FriendRequestItem[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // 折叠状态
  const [requestsExpanded, setRequestsExpanded] = useState(true);
  const [friendsExpanded, setFriendsExpanded] = useState(true);
  const [groupsExpanded, setGroupsExpanded] = useState(true);

  // 获取 Token
  const getAuthToken = async (): Promise<string | null> => {
    const { accessToken } = await TokenStorage.getTokens();
    return accessToken;
  };

  useEffect(() => {
    // 设置页面标题和自定义头部
    navigation.setOptions({
      headerShown: true,
      headerStyle: {
        backgroundColor: '#f8f8f8',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
      },
      headerTitle: 'Contacts',
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: 'bold',
      },
    });
  }, [navigation]);

  useEffect(() => {
    loadContacts();
  }, []);

  // 每次页面聚焦时刷新好友请求
  useFocusEffect(
    React.useCallback(() => {
      fetchFriendRequests();
    }, [])
  );

  /**
   * 获取好友请求列表
   */
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
    } catch (error: any) {
      console.error('[Contacts] Fetch friend requests error:', error.message);
    }
  };

  /**
   * 接受好友请求
   */
  const handleAcceptRequest = async (requestId: string) => {
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
                fetchFriendRequests();
                syncContactsFromServer();
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

  /**
   * 拒绝好友请求
   */
  const handleRejectRequest = async (requestId: string) => {
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
                fetchFriendRequests();
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

  /**
   * Load contacts from local database
   */
  const loadContacts = async () => {
    if (!db) {
      console.log('[Contacts] Database not available');
      setLoading(false);
      return;
    }

    try {
      console.log('[Contacts] Loading contacts from local database...');

      // Load friends
      const friendList = await db.collections
        .get<Friend>('friends')
        .query(Q.sortBy('name', Q.asc))
        .fetch();

      // Load groups
      const groupList = await db.collections
        .get<Group>('groups')
        .query(Q.sortBy('name', Q.asc))
        .fetch();

      setFriends(friendList.map(f => ({
        id: f.friendId,
        name: f.name,
        email: '',
        avatarUrl: f.avatarUrl,
        isOnline: f.isOnline,
      })));

      setGroups(groupList.map(g => ({
        id: g.groupId,
        name: g.name,
        avatarUrl: g.avatarUrl,
        memberCount: g.getMemberIds().length,
      })));

      console.log('[Contacts] Loaded', friendList.length, 'friends and', groupList.length, 'groups');
    } catch (error: any) {
      console.error('[Contacts] Load contacts error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sync contacts from server (friends, groups, friend requests)
   */
  const syncContactsFromServer = async () => {
    if (!db) {
      console.log('[Contacts] Database not available');
      return;
    }

    setSyncing(true);
    try {
      console.log('[Contacts] Syncing contacts from server...');

      // Get current cursors
      const cursors = await db.collections
        .get<SyncCursor>('sync_cursors')
        .query()
        .fetch();

      const friendCursor = cursors[0]?.friendCursor ?? '0';
      const groupCursor = cursors[0]?.groupCursor ?? '0';
      const requestCursor = cursors[0]?.requestCursor ?? '0';

      // Sync from server
      const result = await syncContacts(friendCursor, groupCursor, requestCursor);
      console.log('[Contacts] Sync result:', {
        friendsAdded: result.friends.added.length,
        friendsUpdated: result.friends.updated.length,
        groupsAdded: result.groups.added.length,
        groupsUpdated: result.groups.updated.length,
        requestsAdded: result.friendRequests.added.length,
        requestsRemoved: result.friendRequests.removed.length,
      });

      // Update local database
      await db.write(async () => {
        // Update friends
        for (const friend of result.friends.added) {
          try {
            await db.collections.get<Friend>('friends').create((f: Friend) => {
              f.friendId = friend.id;
              f.name = friend.name;
              f.avatarUrl = friend.avatarUrl || undefined;
              f.isOnline = friend.isOnline;
              f.createdAt = Date.now();
              f.updatedAt = Date.now();
            });
          } catch (e) {
            console.log('[Contacts] Friend already exists:', friend.id);
          }
        }

        for (const friend of result.friends.updated) {
          const existing = await db.collections
            .get<Friend>('friends')
            .query(Q.where('friend_id', Q.eq(friend.id)))
            .fetch();

          if (existing.length > 0) {
            await existing[0].update((f: Friend) => {
              f.name = friend.name;
              f.avatarUrl = friend.avatarUrl || undefined;
              f.isOnline = friend.isOnline;
              f.updatedAt = Date.now();
            });
          }
        }

        // Update groups
        for (const group of result.groups.added) {
          try {
            await db.collections.get<Group>('groups').create((g: Group) => {
              g.groupId = group.id;
              g.name = group.name;
              g.avatarUrl = group.avatarUrl || undefined;
              g.ownerId = group.ownerId;
              g.memberIds = JSON.stringify(group.memberIds);
              g.createdAt = Date.now();
              g.updatedAt = Date.now();
            });
          } catch (e) {
            console.log('[Contacts] Group already exists:', group.id);
          }
        }

        for (const group of result.groups.updated) {
          const existing = await db.collections
            .get<Group>('groups')
            .query(Q.where('group_id', Q.eq(group.id)))
            .fetch();

          if (existing.length > 0) {
            await existing[0].update((g: Group) => {
              g.name = group.name;
              g.avatarUrl = group.avatarUrl || undefined;
              g.ownerId = group.ownerId;
              g.memberIds = JSON.stringify(group.memberIds);
              g.updatedAt = Date.now();
            });
          }
        }

        // Update cursors
        if (cursors.length > 0) {
          await cursors[0].update((c: SyncCursor) => {
            c.friendCursor = result.newFriendCursor;
            c.groupCursor = result.newGroupCursor;
            c.requestCursor = result.newRequestCursor;
          });
        } else {
          await db.collections.get<SyncCursor>('sync_cursors').create((c: SyncCursor) => {
            c.friendCursor = result.newFriendCursor;
            c.groupCursor = result.newGroupCursor;
            c.requestCursor = result.newRequestCursor;
          });
        }
      });

      console.log('[Contacts] Contacts synced successfully');
      loadContacts(); // Reload local data
    } catch (error: any) {
      console.error('[Contacts] Sync contacts error:', error.message);
    } finally {
      setSyncing(false);
    }
  };

  /**
   * Handle friend press - navigate to chat
   */
  const handleFriendPress = async (friend: FriendItem) => {
    console.log('[Contacts] Friend pressed:', friend);
    
    navigation.navigate('ChatDetail', {
      chatId: friend.id,
      chatName: friend.name,
      chatType: 'direct',
    });
  };

  /**
   * Handle group press - navigate to chat
   */
  const handleGroupPress = async (group: GroupItem) => {
    console.log('[Contacts] Group pressed:', group);
    
    navigation.navigate('ChatDetail', {
      chatId: group.id,
      chatName: group.name,
      chatType: 'group',
    });
  };

  /**
   * Build list data with collapsible sections
   */
  const renderListData = () => {
    const data: any[] = [];

    // Friend requests section
    data.push({
      type: 'sectionHeader',
      key: 'requestsHeader',
      title: '新好友申请',
      count: friendRequests.length,
      expanded: requestsExpanded,
      toggle: () => setRequestsExpanded(!requestsExpanded),
    });

    if (requestsExpanded && friendRequests.length > 0) {
      friendRequests.forEach((request) => {
        data.push({
          type: 'request',
          key: `request-${request.id}`,
          request,
        });
      });
    }

    if (requestsExpanded && friendRequests.length === 0) {
      data.push({
        type: 'empty',
        key: 'requestsEmpty',
        message: '暂无好友申请',
      });
    }

    // Friends section
    data.push({
      type: 'sectionHeader',
      key: 'friendsHeader',
      title: '好友',
      count: friends.length,
      expanded: friendsExpanded,
      toggle: () => setFriendsExpanded(!friendsExpanded),
    });

    if (friendsExpanded && friends.length > 0) {
      friends.forEach((friend) => {
        data.push({
          type: 'friend',
          key: `friend-${friend.id}`,
          friend,
        });
      });
    }

    if (friendsExpanded && friends.length === 0) {
      data.push({
        type: 'empty',
        key: 'friendsEmpty',
        message: '暂无好友',
      });
    }

    // Groups section
    data.push({
      type: 'sectionHeader',
      key: 'groupsHeader',
      title: '群组',
      count: groups.length,
      expanded: groupsExpanded,
      toggle: () => setGroupsExpanded(!groupsExpanded),
    });

    if (groupsExpanded && groups.length > 0) {
      groups.forEach((group) => {
        data.push({
          type: 'group',
          key: `group-${group.id}`,
          group,
        });
      });
    }

    if (groupsExpanded && groups.length === 0) {
      data.push({
        type: 'empty',
        key: 'groupsEmpty',
        message: '暂无群组',
      });
    }

    return data;
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item.type === 'sectionHeader') {
      return (
        <SectionHeader
          title={item.title}
          count={item.count}
          expanded={item.expanded}
          onPress={item.toggle}
        />
      );
    }

    if (item.type === 'request') {
      return (
        <FriendRequestItemComponent
          request={item.request}
          onAccept={handleAcceptRequest}
          onReject={handleRejectRequest}
        />
      );
    }

    if (item.type === 'friend') {
      return <FriendItemComponent friend={item.friend} onPress={handleFriendPress} />;
    }

    if (item.type === 'group') {
      return <GroupItemComponent group={item.group} onPress={handleGroupPress} />;
    }

    if (item.type === 'empty') {
      return (
        <View style={styles.emptyItem}>
          <Text style={styles.emptyText}>{item.message}</Text>
        </View>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载联系人...</Text>
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
        refreshing={syncing}
        onRefresh={syncContactsFromServer}
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
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 8,
  },
  sectionHeaderArrow: {
    fontSize: 18,
    color: '#999',
    fontWeight: 'bold',
  },
  sectionHeaderArrowExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  // Empty item
  emptyItem: {
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
  // Friend request item
  requestItem: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  requestInfo: {
    marginBottom: 12,
  },
  requestSender: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  requestEmail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  requestMessage: {
    fontSize: 13,
    color: '#666',
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  requestTime: {
    fontSize: 12,
    color: '#999',
  },
  requestButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  requestButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#34C759',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#f0f0f0',
  },
  rejectButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  // Friend item
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
    marginRight: 12,
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
