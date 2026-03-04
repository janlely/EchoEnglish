import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Q } from '@nozbe/watermelondb';
import { Group, GroupMember, Friend, Conversation } from '../database/models';
import { GroupDetailScreenNavigationProp } from '../types/navigation';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarUrl } from '../utils/avatar';
import { updateGroupName } from '../api/groups';
import logger from '../utils/logger';

const GroupDetailScreen = () => {
  const navigation = useNavigation<GroupDetailScreenNavigationProp>();
  const route = useRoute();
  const { groupId, groupName: initialGroupName } = route.params as { groupId: string; groupName: string };
  const { user } = useAuth();
  const database = useDatabase();
  const textInputRef = useRef<TextInput>(null);
  
  const [groupName, setGroupName] = useState(initialGroupName);
  const [members, setMembers] = useState<any[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempGroupName, setTempGroupName] = useState(initialGroupName);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load group members
  useEffect(() => {
    const loadMembers = async () => {
      if (!database) return;
      
      try {
        // Get group members from local database
        const dbMembers = await database.collections
          .get<GroupMember>('group_members')
          .query(Q.where('group_id', Q.eq(groupId)))
          .fetch();

        // Get friend details for each member
        const memberDetails = await Promise.all(
          dbMembers.map(async (member) => {
            // Try to get friend details from local database
            const friendRecord = await database.collections
              .get<Friend>('friends')
              .query(Q.where('friend_id', Q.eq(member.userId)))
              .fetch();

            return {
              id: member.userId,
              name: friendRecord.length > 0 ? friendRecord[0].name : member.name,
              avatarUrl: friendRecord.length > 0 ? friendRecord[0].avatarUrl : member.avatarUrl,
              role: member.role,
            };
          })
        );

        // Try to determine the current user's role by checking the group record
        const groupRecords = await database.collections
          .get<Group>('groups')
          .query(Q.where('group_id', Q.eq(groupId)))
          .fetch();
        
        const currentRole = groupRecords.length > 0 && groupRecords[0].ownerId === user?.id ? 'owner' : 'member';

        // Add current user to the list if not already present
        let finalMembers = [...memberDetails];
        if (user && !memberDetails.some(member => member.id === user.id)) {
          // Get current user's info from friends table
          const currentUserFriendRecords = await database.collections
            .get<Friend>('friends')
            .query(Q.where('friend_id', Q.eq(user.id)))
            .fetch();

          const currentUserInfo = currentUserFriendRecords.length > 0 ? currentUserFriendRecords[0] : null;

          const currentUser = {
            id: user.id,
            name: currentUserInfo?.name || user.name || 'Current User',
            avatarUrl: currentUserInfo?.avatarUrl || user.avatarUrl,
            role: currentRole,
          };

          // Add current user to the list
          finalMembers.push(currentUser);
        }
        
        setMembers(finalMembers);
      } catch (error) {
        logger.error('GroupDetailScreen', 'Load members error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, [database, groupId]);

  // Update group name
  const handleUpdateGroupName = async (newName: string) => {
    if (!database || !user || isSaving) return;

    setIsSaving(true);

    try {
      if (newName.trim() === '' || newName === groupName) {
        setTempGroupName(groupName); // Reset to original name if empty or same
        setIsEditingName(false);
        setIsSaving(false);
        return;
      }

      // Attempt to update on server
      let serverUpdateSuccess = false;
      try {
        const result = await updateGroupName(groupId, newName);
        if (result) {
          serverUpdateSuccess = true;
        }
      } catch (serverError) {
        logger.warn('GroupDetailScreen', 'Server update failed, updating locally only:', serverError);
        // Continue with local update even if server fails
      }

      // Update in database regardless of server success
      await database.write(async () => {
        logger.debug('GroupDetailScreen', 'Updating group name in database:', newName);
        const groupRecords = await database.collections
          .get<Group>('groups')
          .query(Q.where('group_id', Q.eq(groupId)))
          .fetch();

        if (groupRecords.length > 0) {
          await groupRecords[0].update((g: Group) => {
            g.name = newName;
            g.updatedAt = Date.now();
          });
          logger.debug('GroupDetailScreen', 'Updated group record with new name');
        }

        // Also update the corresponding conversation record to ensure the header updates
        const conversationId = `group_${groupId}`; // This matches the generateGroupConversationId function
        logger.debug('GroupDetailScreen', 'Looking for conversation record:', conversationId);
        const conversationRecords = await database.collections
          .get<Conversation>('conversations')
          .query(Q.where('conversation_id', Q.eq(conversationId)))
          .fetch();

        if (conversationRecords.length > 0) {
          await conversationRecords[0].update((c: Conversation) => {
            // Update the conversation's latest summary to reflect the new group name
            c.latestSummary = `${newName}`;
            c.updatedAt = Date.now();
          });
          logger.debug('GroupDetailScreen', 'Updated conversation record with new name');
        } else {
          logger.warn('GroupDetailScreen', 'No conversation record found for:', conversationId);
        }
      });

      // Update local state
      setGroupName(newName);
      setTempGroupName(newName);
      setIsEditingName(false);
      
      if (!serverUpdateSuccess) {
        Alert.alert('提示', '群名称已更新（本地），同步到服务器失败');
      }
    } catch (error) {
      logger.error('GroupDetailScreen', 'Update group name error:', error);
      // Revert to original name
      setTempGroupName(groupName);
      setIsEditingName(false);
      Alert.alert('错误', '更新群名称失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle blur from text input
  const handleBlur = () => {
    // Only save if we're not already saving to avoid double saving
    if (!isSaving) {
      handleUpdateGroupName(tempGroupName);
    }
  };

  // Handle tap outside - save and dismiss keyboard
  const handleTapOutside = () => {
    if (isEditingName && !isSaving) {
      textInputRef.current?.blur();
    }
  };

  // Determine current user's role in the group
  const currentUserRole = members.find(member => member.id === user?.id)?.role || null;
  const isOwner = currentUserRole === 'owner';

  // Handle group disband
  const handleDisbandGroup = () => {
    Alert.alert(
      '解散群聊',
      '确定要解散此群聊吗？此操作不可撤销。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            // TODO: Implement group disband functionality
            Alert.alert('功能开发中', '群解散功能正在开发中');
          },
        },
      ]
    );
  };

  // Handle member press
  const handleMemberPress = (member: any) => {
    // If editing name, save it first
    if (isEditingName && !isSaving) {
      handleUpdateGroupName(tempGroupName);
    }
    
    // Navigate to user profile or direct chat if not the current user
    if (member.id !== user?.id) {
      // TODO: Navigate to user profile or direct chat
      Alert.alert('功能开发中', '查看成员详情功能正在开发中');
    }
  };

  // Handle add member press
  const handleAddMemberPress = () => {
    // If editing name, save it first
    if (isEditingName && !isSaving) {
      handleUpdateGroupName(tempGroupName);
    }
    
    // Navigate to add members screen
    Alert.alert('功能开发中', '添加成员功能正在开发中');
  };

  // Render member item as a grid item
  const renderGridMemberItem = (member: any) => {
    const isCurrentUser = member.id === user?.id;
    const isOwner = member.role === 'owner';

    return (
      <TouchableOpacity
        key={member.id}
        style={styles.gridItem}
        onPress={() => handleMemberPress(member)}
      >
        <View style={styles.gridAvatarContainer}>
          {member.avatarUrl ? (
            <Image
              source={{ uri: getAvatarUrl(member.avatarUrl, 50) }}
              style={styles.gridAvatarImage}
            />
          ) : (
            <Text style={styles.gridAvatarText}>
              {member.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <Text style={styles.gridMemberName} numberOfLines={1}>
          {member.name}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render add member item
  const renderAddMemberItem = () => (
    <TouchableOpacity 
      style={styles.gridItem}
      onPress={handleAddMemberPress}
    >
      <View style={styles.addMemberContainer}>
        <Text style={styles.addMemberIcon}>+</Text>
      </View>
      <Text style={styles.gridMemberName}>添加</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback 
        onPress={handleTapOutside}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Group Name Section */}
          <View style={styles.groupNameSection}>
            <Text style={styles.sectionTitle}>群名称</Text>
            <View style={styles.groupNameContainer}>
              {isEditingName ? (
                <TextInput
                  ref={textInputRef}
                  style={styles.nameInput}
                  value={tempGroupName}
                  onChangeText={setTempGroupName}
                  onBlur={handleBlur}
                  onSubmitEditing={handleBlur}
                  blurOnSubmit={true}
                  onFocus={() => setIsEditingName(true)}
                />
              ) : (
                <Text style={styles.groupName} onPress={() => {
                  setIsEditingName(true);
                  setTimeout(() => {
                    textInputRef.current?.focus();
                  }, 100);
                }}>
                  {groupName}
                </Text>
              )}
            </View>
          </View>

          {/* Members Grid Section */}
          <View style={styles.membersSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>群成员 ({members.length})</Text>
            </View>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text>加载中...</Text>
              </View>
            ) : (
              <View style={styles.membersGrid}>
                {members.map(renderGridMemberItem)}
                {renderAddMemberItem()}
              </View>
            )}
          </View>

          {/* Action Buttons - Show appropriate button based on user role */}
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={[
                styles.actionButton, 
                isOwner ? styles.disbandButton : styles.leaveButton
              ]}
              onPress={isOwner ? handleDisbandGroup : () => Alert.alert('功能开发中', '退出群聊功能正在开发中')}
            >
              <Text style={[
                styles.actionButtonText, 
                isOwner ? styles.disbandButtonText : styles.leaveButtonText
              ]}>
                {isOwner ? '解散群聊' : '退出群聊'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  groupNameSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  groupNameContainer: {
    width: '100%',
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#007AFF',
  },
  membersSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  gridItem: {
    width: '20%', // 5 items per row (100% / 5 = 20%)
    alignItems: 'center',
    padding: 8,
    marginBottom: 8,
  },
  gridAvatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    overflow: 'hidden', // Ensure the image stays within the circle
  },
  gridAvatarImage: {
    width: 50,
    height: 50,
  },
  gridAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  gridMemberName: {
    fontSize: 12,
    textAlign: 'center',
    color: '#333',
  },
  addMemberContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  addMemberIcon: {
    fontSize: 24,
    color: '#ccc',
    fontWeight: 'bold',
  },
  actionSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
  },
  actionButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
  },
  disbandButton: {
    backgroundColor: '#FFE5E5',
  },
  disbandButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  leaveButton: {
    backgroundColor: '#FFE5E5',
  },
  leaveButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default GroupDetailScreen;