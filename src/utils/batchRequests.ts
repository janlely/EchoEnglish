/**
 * Utility functions for handling batch API requests to avoid rate limiting
 */

import { getUserInfo } from '../api/user';
import logger from './logger';

interface RequestQueueItem<T> {
  id: string;
  resolver: (value: T) => void;
  rejecter: (reason: any) => void;
}

// Queue for pending user info requests
const pendingUserInfoRequests = new Map<string, Promise<any>>();

/**
 * Batch fetch user info with deduplication to prevent multiple requests for the same user
 */
export const batchGetUserInfo = async (userId: string) => {
  // If we already have a pending request for this user, return the same promise
  if (pendingUserInfoRequests.has(userId)) {
    logger.debug('batchGetUserInfo', `Reusing pending request for user: ${userId}`);
    return pendingUserInfoRequests.get(userId);
  }

  // Create a new promise for this user
  const requestPromise = getUserInfo(userId)
    .then(userInfo => {
      // Clean up the map when request completes
      pendingUserInfoRequests.delete(userId);
      return userInfo;
    })
    .catch(error => {
      // Clean up the map when request fails
      pendingUserInfoRequests.delete(userId);
      throw error;
    });

  // Store the promise in the map
  pendingUserInfoRequests.set(userId, requestPromise);

  return requestPromise;
};

/**
 * Batch fetch multiple user infos efficiently
 */
export const batchGetUserInfos = async (userIds: string[]): Promise<any[]> => {
  if (!userIds || userIds.length === 0) {
    return [];
  }

  // Deduplicate user IDs
  const uniqueUserIds = [...new Set(userIds)];
  
  try {
    // Use the batch API endpoint if available
    const { getUsersBatch } = await import('../api/user');
    return await getUsersBatch(uniqueUserIds);
  } catch (error) {
    // Fallback to individual requests with deduplication
    logger.warn('batchGetUserInfos', 'Batch API not available, falling back to individual requests');
    const results = [];
    
    for (const userId of uniqueUserIds) {
      try {
        const userInfo = await batchGetUserInfo(userId);
        results.push(userInfo);
      } catch (err) {
        logger.error('batchGetUserInfos', `Failed to get user info for ${userId}:`, err);
      }
    }
    
    return results;
  }
};