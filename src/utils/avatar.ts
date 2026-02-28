import { API_CONFIG } from '../config/constants';
import RNFS from 'react-native-fs';

/**
 * Get the local avatar directory path
 */
export const getAvatarDirectory = (): string => {
  return `${RNFS.DocumentDirectoryPath}/avatars`;
};

/**
 * Ensure avatar directory exists
 */
export const ensureAvatarDirectory = async (): Promise<void> => {
  const avatarDir = getAvatarDirectory();
  const exists = await RNFS.exists(avatarDir);
  if (!exists) {
    await RNFS.mkdir(avatarDir);
  }
};

/**
 * Download avatar from server and save locally
 * @param remoteUrl - Remote avatar URL (relative or absolute)
 * @param userId - User ID for local filename
 * @returns Local file path
 */
export const downloadAndSaveAvatar = async (
  remoteUrl: string,
  userId: string
): Promise<string> => {
  await ensureAvatarDirectory();

  // Construct full URL if needed
  const fullUrl = remoteUrl.startsWith('http')
    ? remoteUrl
    : `${API_CONFIG.BASE_URL}${remoteUrl}`;

  // Extract filename from URL for cache busting
  const urlFilename = remoteUrl.split('/').pop() || '';
  const ext = urlFilename.includes('.') ? urlFilename.split('.').pop() : 'jpg';

  // Use the same filename as the server to preserve cache busting
  const localFilename = urlFilename || `${userId}.${ext}`;
  const localPath = `${getAvatarDirectory()}/${localFilename}`;

  // Check if file already exists
  const exists = await RNFS.exists(localPath);
  if (exists) {
    // Check if it's the same file (by comparing URL filename)
    // If URL has changed, we need to download the new one
    const oldFilename = localPath.split('/').pop();
    if (oldFilename === localFilename) {
      console.log('[Avatar] File already exists locally:', localPath);
      return localPath;
    }
  }

  // Download file
  console.log('[Avatar] Downloading from:', fullUrl);
  const downloadResult = await RNFS.downloadFile({
    fromUrl: fullUrl,
    toFile: localPath,
  }).promise;

  if (downloadResult.statusCode !== 200) {
    throw new Error(`Failed to download avatar: ${downloadResult.statusCode}`);
  }

  console.log('[Avatar] Saved to:', localPath);

  // Clean up old avatar files for this user
  await cleanupOldAvatars(userId, localFilename);

  return localPath;
};

/**
 * Clean up old avatar files for a user
 */
export const cleanupOldAvatars = async (userId: string, currentFilename: string): Promise<void> => {
  try {
    const avatarDir = getAvatarDirectory();
    const exists = await RNFS.exists(avatarDir);
    if (!exists) return;

    const files = await RNFS.readDir(avatarDir);
    const userAvatarPattern = new RegExp(`^${userId}_[0-9]+_[a-f0-9]+\\.[a-z]+$`);

    for (const file of files) {
      // Delete old avatar files matching the pattern, but not the current one
      if (userAvatarPattern.test(file.name) && file.name !== currentFilename) {
        await RNFS.unlink(file.path);
        console.log('[Avatar] Cleaned up old avatar:', file.name);
      }
    }
  } catch (error) {
    console.warn('[Avatar] Failed to cleanup old avatars:', error);
  }
};

/**
 * Get full avatar URL from path
 * If the path is already a full URL, return it as is
 * If the path is a relative path, construct full URL from API_CONFIG.BASE_URL
 * If no path provided, return placeholder
 */
export const getAvatarUrl = (avatarPath?: string | null, placeholderSize: number = 100): string => {
  if (!avatarPath) return `https://placehold.co/${placeholderSize}x${placeholderSize}`;
  if (avatarPath.startsWith('http')) return avatarPath;
  if (avatarPath.startsWith('/')) return `${API_CONFIG.BASE_URL}${avatarPath}`;
  // Assume it's a local file path
  if (avatarPath.startsWith('file://') || avatarPath.startsWith('/var/') || avatarPath.includes('Documents')) {
    return `file://${avatarPath.replace('file://', '')}`;
  }
  return `${API_CONFIG.BASE_URL}/${avatarPath}`;
};

/**
 * Get avatar URL with local path preference
 * Returns local file path if available, otherwise falls back to remote URL
 */
export const getDisplayAvatarUrl = (
  localPath?: string | null,
  remoteUrl?: string | null,
  placeholderSize: number = 100
): string => {
  // Prefer local path if it exists
  if (localPath) {
    return localPath.startsWith('file://') ? localPath : `file://${localPath}`;
  }
  // Fall back to remote URL
  return getAvatarUrl(remoteUrl, placeholderSize);
};