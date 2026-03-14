import { API_CONFIG } from '../config/constants';
import { getAuthToken } from '../services/ApiService';

export interface Group {
  id: string;
  name: string;
  avatarUrl?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupResponse {
  success: boolean;
  data?: {
    group: Group;
  };
  error?: string;
}

/**
 * Create a new group chat
 * @param name - Group name
 * @param memberIds - Array of friend IDs to add to the group (at least 2)
 */
export const createGroup = async (
  name: string,
  memberIds: string[]
): Promise<CreateGroupResponse> => {
  try {
    const token = await getAuthToken();

    // Note: The API endpoint is /api/contacts/groups, not /api/groups
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/contacts/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        name,
        memberIds,
      }),
    });

    const data: CreateGroupResponse = await response.json() as CreateGroupResponse;

    return data;
  } catch (error: any) {
    return {
      success: false,
      data: {
        group: {
          id: '',
          name: '',
          ownerId: '',
          createdAt: '',
          updatedAt: '',
        },
      },
      error: error.message || 'Failed to create group',
    };
  }
};

/**
 * Get group info by group ID
 * @param groupId - The group ID
 */
export const getGroupInfo = async (groupId: string): Promise<any> => {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_CONFIG.BASE_URL}/api/groups/${groupId}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data: any = await response.json();

    if (response.ok && data.success) {
      return data.data;
    }

    return null;
  } catch (error) {
    console.error('[Groups API] Get group info error:', error);
    return null;
  }
};

/**
 * Update group name
 * @param groupId - The group ID
 * @param name - The new group name
 */
export const updateGroupName = async (groupId: string, name: string): Promise<any> => {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_CONFIG.BASE_URL}/api/contacts/groups/${groupId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        name,
      }),
    });

    const data: any = await response.json();

    if (response.ok && data.success) {
      return data.data;
    }

    return null;
  } catch (error) {
    console.error('[Groups API] Update group name error:', error);
    return null;
  }
};

/**
 * Delete (dissolve) a group
 * @param groupId - The group ID to dissolve
 */
export const deleteGroup = async (groupId: string): Promise<any> => {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_CONFIG.BASE_URL}/api/contacts/groups/${groupId}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data: any = await response.json();

    if (response.ok && data.success) {
      return data;
    }

    return null;
  } catch (error) {
    console.error('[Groups API] Delete group error:', error);
    return null;
  }
};
