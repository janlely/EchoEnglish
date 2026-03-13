import { ApiService } from '../services/ApiService';

export interface Friend {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
}

export interface GroupMember {
  userId: string;
  name: string;
  avatarUrl?: string;
  role: 'owner' | 'admin' | 'member';
}

export interface FriendRequest {
  id: string;
  sender: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt?: string;
}

export interface FriendRequestResult {
  requests: FriendRequest[];
  unreadCount: number;
  newRequestCursor?: string;
}

export interface Group {
  id: string;
  name: string;
  avatarUrl?: string | null;
  ownerId: string;
  memberIds: string[];
  members?: GroupMember[]; // Group member details
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
 * 获取单个群信息
 */
export const getGroupInfo = async (groupId: string): Promise<Group> => {
  const response = await ApiService.request<{ success: boolean; data: { group: Group } }>(
    `/api/contacts/groups/${groupId}`
  );
  return response.data!.group;
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

/**
 * 获取待处理的好友申请列表
 */
export const getPendingFriendRequests = async (): Promise<FriendRequestResult> => {
  const response = await ApiService.request<{ success: boolean; data: { requests: FriendRequest[] } }>(
    '/api/friends/requests'
  );
  // Backend doesn't return unreadCount, calculate locally
  return {
    requests: response.data!.requests,
    unreadCount: response.data!.requests.length, // All pending requests are considered unread from server perspective
    newRequestCursor: undefined,
  };
};

/**
 * 获取好友申请未读数量（未使用，保留以备将来使用）
 */
export const getFriendRequestUnreadCount = async (): Promise<number> => {
  // Backend doesn't have this endpoint, return 0
  // Frontend calculates unread count locally based on is_read flag
  return 0;
};

/**
 * 接受好友申请
 */
export const acceptFriendRequest = async (requestId: string): Promise<void> => {
  await ApiService.request(`/api/friends/requests/${requestId}/accept`, {
    method: 'POST',
  });
};

/**
 * 拒绝好友申请
 */
export const rejectFriendRequest = async (requestId: string): Promise<void> => {
  await ApiService.request(`/api/friends/requests/${requestId}/reject`, {
    method: 'POST',
  });
};

/**
 * 标记好友申请为已读（仅更新本地，后端未实现此接口）
 */
export const markFriendRequestAsRead = async (requestId: string): Promise<void> => {
  // Backend doesn't have this endpoint, only update local DB in FriendRequestService
  return Promise.resolve();
};

/**
 * 标记所有好友申请为已读（仅更新本地，后端未实现此接口）
 */
export const markAllFriendRequestsAsRead = async (): Promise<void> => {
  // Backend doesn't have this endpoint, only update local DB in FriendRequestService
  return Promise.resolve();
};
