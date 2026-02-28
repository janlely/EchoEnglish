import { ApiService } from '../services/ApiService';

export interface Friend {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
}

export interface Group {
  id: string;
  name: string;
  avatarUrl?: string | null;
  ownerId: string;
  memberIds: string[];
}

export interface SyncContactsResult {
  friends: {
    added: Friend[];
    updated: Friend[];
    removed: string[];
  };
  groups: {
    added: Group[];
    updated: Group[];
    removed: string[];
  };
  friendRequests: {
    added: {
      id: string;
      sender: {
        id: string;
        name: string;
        email: string;
        avatarUrl?: string | null;
      };
      message?: string;
      createdAt: string;
    }[];
    removed: string[];
  };
  newFriendCursor: string;
  newGroupCursor: string;
  newRequestCursor: string;
}

/**
 * 增量同步联系人（好友、群组、好友请求）
 */
export const syncContacts = async (
  friendCursor?: string,
  groupCursor?: string,
  requestCursor?: string
): Promise<SyncContactsResult> => {
  const params = new URLSearchParams();
  if (friendCursor !== undefined) params.append('friendCursor', friendCursor);
  if (groupCursor !== undefined) params.append('groupCursor', groupCursor);
  if (requestCursor !== undefined) params.append('requestCursor', requestCursor);

  const response = await ApiService.request<{ success: boolean; data: SyncContactsResult }>(
    `/api/contacts/sync?${params.toString()}`
  );
  return response.data!;
};

/**
 * 获取好友列表
 */
export const getFriends = async (): Promise<Friend[]> => {
  const response = await ApiService.request<{ success: boolean; data: { friends: Friend[] } }>('/api/contacts/friends');
  return response.data!.friends;
};

/**
 * 获取群组列表
 */
export const getGroups = async (): Promise<Group[]> => {
  const response = await ApiService.request<{ success: boolean; data: { groups: Group[] } }>('/api/contacts/groups');
  return response.data!.groups;
};

/**
 * 创建群组
 */
export const createGroup = async (
  name: string,
  avatarUrl?: string,
  memberIds: string[] = []
): Promise<Group> => {
  const response = await ApiService.request<{ success: boolean; data: { group: Group } }>('/api/contacts/groups', {
    method: 'POST',
    body: JSON.stringify({ name, avatarUrl, memberIds }),
  });
  return response.data!.group;
};

/**
 * 添加群成员
 */
export const addGroupMember = async (groupId: string, memberId: string): Promise<void> => {
  await ApiService.request(`/api/contacts/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ memberId }),
  });
};

/**
 * 移除群成员
 */
export const removeGroupMember = async (groupId: string, memberId: string): Promise<void> => {
  await ApiService.request(`/api/contacts/groups/${groupId}/members`, {
    method: 'DELETE',
    body: JSON.stringify({ memberId }),
  });
};
