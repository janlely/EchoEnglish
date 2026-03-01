import { ApiService } from '../services/ApiService';
import { Platform } from 'react-native';
import { TokenStorage } from '../services/TokenStorage';
import { API_CONFIG } from '../config/constants';
import RNFetchBlob from 'react-native-blob-util';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  isOnline: boolean;
}

/**
 * Get current user profile
 */
export const getUserProfile = async (): Promise<{ user: UserProfile }> => {
  const response = await ApiService.request<{ success: boolean; data: { user: UserProfile } }>(
    '/api/users/profile'
  );
  return response.data!;
};

/**
 * Upload avatar using react-native-blob-util
 * More reliable than FormData for file uploads on React Native
 */
export const uploadAvatar = async (imageUri: string): Promise<{ avatarUrl: string }> => {
  try {
    console.log('[uploadAvatar] Starting upload, imageUri:', imageUri);

    // Get token
    const { accessToken } = await TokenStorage.getTokens();
    console.log('[uploadAvatar] Access token:', accessToken ? 'exists' : 'null');

    const url = `${API_CONFIG.BASE_URL}/api/users/avatar`;
    console.log('[uploadAvatar] Upload URL:', url);

    // Extract filename and determine mime type
    const filename = imageUri.split('/').pop() || 'avatar.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const ext = match ? match[1].toLowerCase() : 'jpg';
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const mimeType = mimeTypes[ext] || 'image/jpeg';

    // Prepare the file path (remove file:// prefix if present)
    const filePath = imageUri.replace('file://', '').replace('file:', '');

    console.log('[uploadAvatar] File path:', filePath);
    console.log('[uploadAvatar] Mime type:', mimeType);

    const response = await RNFetchBlob.fetch(
      'POST',
      url,
      {
        'Content-Type': 'multipart/form-data',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      [
        {
          name: 'avatar',
          filename: filename,
          type: mimeType,
          data: RNFetchBlob.wrap(filePath),
        },
      ]
    );

    console.log('[uploadAvatar] Response status:', response.info().status);
    console.log('[uploadAvatar] Response text:', response.text());

    const status = response.info().status;
    if (status !== 200 && status !== 201) {
      const errorData = response.json();
      throw new Error(errorData?.error || `Upload failed with status ${status}`);
    }

    const data = response.json();
    console.log('[uploadAvatar] Response data:', data);

    return data.data!;
  } catch (error: any) {
    console.error('[uploadAvatar] Error:', error);
    throw error;
  }
};

/**
 * Get user by ID
 */
export const getUserInfo = async (userId: string): Promise<UserProfile> => {
  const response = await ApiService.request<{ success: boolean; data: { user: UserProfile } }>(
    `/api/users/${userId}`
  );
  return response.data!.user;
};

/**
 * Get users by IDs (batch)
 */
export const getUsersBatch = async (userIds: string[]): Promise<UserProfile[]> => {
  const response = await ApiService.request<{ success: boolean; data: { users: UserProfile[] } }>(
    '/api/users/batch',
    {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    }
  );
  return response.data!.users;
};
