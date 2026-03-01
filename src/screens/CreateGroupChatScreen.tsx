import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Q } from '@nozbe/watermelondb';
import { Friend } from '../database/models';
import { CreateGroupChatScreenNavigationProp } from '../types/navigation';
import { createGroup } from '../api/groups';
import { getAvatarUrl } from '../utils/avatar';

interface FriendInterface {
  id: string;
  friendId: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

const MIN_MEMBERS = 2; // Minimum number of members required to create a group (plus yourself = 3 total)

const CreateGroupChatScreen = () => {
  const navigation = useNavigation<CreateGroupChatScreenNavigationProp>();
  const database = useDatabase();
  const [searchText, setSearchText] = useState('');
  const [allFriends, setAllFriends] = useState<FriendInterface[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<FriendInterface[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Load all friends from local database
  useEffect(() => {
    const loadFriends = async () => {
      if (!database) {
        setLoading(false);
        return;
      }

      try {
        const friends = await database.collections
          .get<Friend>('friends')
          .query(Q.sortBy('name', Q.asc))
          .fetch();

        const formattedFriends = friends.map(f => ({
          id: f.id,
          friendId: f.friendId,
          name: f.name,
          email: f.email,
          avatarUrl: f.avatarUrl,
          isOnline: f.isOnline,
        }));

        setAllFriends(formattedFriends);
        setFilteredFriends(formattedFriends);
      } catch (error) {
        console.error('[CreateGroupChat] Load friends error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFriends();
  }, [database]);

  // Filter friends based on search text
  useEffect(() => {
    if (searchText.trim() === '') {
      setFilteredFriends(allFriends);
    } else {
      const filtered = allFriends.filter(friend =>
        friend.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (friend.email && friend.email.toLowerCase().includes(searchText.toLowerCase()))
      );
      setFilteredFriends(filtered);
    }
  }, [searchText, allFriends]);

  // Toggle member selection
  const toggleMemberSelection = (friendId: string) => {
    setSelectedMemberIds(prev => {
      if (prev.includes(friendId)) {
        return prev.filter(id => id !== friendId);
      } else {
        return [...prev, friendId];
      }
    });
  };

  // Create group chat
  const handleCreateGroup = async () => {
    if (selectedMemberIds.length < MIN_MEMBERS) {
      Alert.alert('提示', `请至少选择 ${MIN_MEMBERS} 位用户来创建群聊（加上您自己共 ${MIN_MEMBERS + 1} 人）`);
      return;
    }

    const groupName = `群聊-${selectedMemberIds.length + 1}人`;

    setCreating(true);
    try {
      const result = await createGroup(groupName, selectedMemberIds);

      if (result.success && result.data?.group) {
        Alert.alert(
          '创建成功',
          `群聊 "${result.data.group.name}" 已创建`,
          [
            {
              text: '确定',
              onPress: () => {
                // Navigate to the new group chat
                navigation.navigate('ChatDetail', {
                  chatId: result.data!.group.id,
                  chatName: result.data!.group.name,
                  chatType: 'group',
                });
              },
            },
          ]
        );
      } else {
        Alert.alert('创建失败', result.error || '请稍后重试');
      }
    } catch (error: any) {
      Alert.alert('创建失败', error.message || '请稍后重试');
    } finally {
      setCreating(false);
    }
  };

  // Render friend item
  const renderFriendItem = ({ item }: { item: FriendInterface }) => {
    const isSelected = selectedMemberIds.includes(item.friendId);

    return (
      <TouchableOpacity
        style={styles.friendItem}
        onPress={() => toggleMemberSelection(item.friendId)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {item.avatarUrl ? (
            <View style={styles.avatarImage}>
              <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
            </View>
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
            </View>
          )}
        </View>
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.name}</Text>
          {item.email && (
            <Text style={styles.friendEmail} numberOfLines={1}>
              {item.email}
            </Text>
          )}
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载通讯录...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索联系人"
          placeholderTextColor="#999"
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Friend List */}
      <FlatList
        data={filteredFriends}
        renderItem={renderFriendItem}
        keyExtractor={(item) => item.friendId}
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无联系人</Text>
          </View>
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>通讯录 ({filteredFriends.length}人)</Text>
          </View>
        }
      />

      {/* Create Button */}
      <View style={styles.footerContainer}>
        <View style={styles.selectionInfo}>
          <Text style={styles.selectionText}>
            已选择 {selectedMemberIds.length} 人
          </Text>
          {selectedMemberIds.length > 0 && selectedMemberIds.length < MIN_MEMBERS && (
            <Text style={styles.hintText}>
              （还需选择 {MIN_MEMBERS - selectedMemberIds.length} 人）
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.createButton,
            selectedMemberIds.length < MIN_MEMBERS && styles.createButtonDisabled,
            creating && styles.createButtonCreating,
          ]}
          onPress={handleCreateGroup}
          disabled={selectedMemberIds.length < MIN_MEMBERS || creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>创建群聊</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  listContainer: {
    flex: 1,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  listHeaderTitle: {
    fontSize: 14,
    color: '#666',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatarImage: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  avatarPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  friendEmail: {
    fontSize: 13,
    color: '#666',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  selectionInfo: {
    flex: 1,
  },
  selectionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  hintText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#99C9FF',
  },
  createButtonCreating: {
    opacity: 0.8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateGroupChatScreen;
