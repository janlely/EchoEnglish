/**
 * MainTabNavigator - 主 Tab 导航器
 *
 * 红点逻辑：
 * - 当用户在 Chats tab 时，不显示红点（会话列表会显示未读计数）
 * - 当用户不在 Chats tab 时，收到新消息才显示红点，显示总未读计数
 */

import React, { useState, useEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Q } from '@nozbe/watermelondb';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useFocusEffect } from '@react-navigation/native';
import { Conversation } from '../database/models';
import MainScreen from '../screens/MainScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { messageService } from '../services/MessageService';
import { friendRequestService } from '../services/FriendRequestService';
import logger from '../utils/logger';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Chat Stack Navigator to handle chat details
const ChatStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: true}}>
    <Stack.Screen name="MainChat" component={MainScreen} />
    <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
  </Stack.Navigator>
);

// Contacts Stack Navigator
const ContactsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: true }}>
    <Stack.Screen name="ContactsMain" component={ContactsScreen} />
  </Stack.Navigator>
);

// Profile Stack Navigator
const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain" component={ProfileScreen} />
  </Stack.Navigator>
);

// Placeholder components for other tabs
const DiscoverScreen = () => (
  <View style={styles.tabContent}>
    <Text>Discover Screen</Text>
  </View>
);

// Chats Screen Wrapper - 使用 useFocusEffect 跟踪 Chats tab 是否获得焦点
const ChatsScreenWithFocusTracker: React.FC<{
  setIsOnChatsTab: (value: boolean) => void;
}> = ({ setIsOnChatsTab }) => {
  useFocusEffect(
    React.useCallback(() => {
      logger.info('ChatsScreenWithFocusTracker', 'Chats tab focused');
      setIsOnChatsTab(true);
      return () => {
        logger.info('ChatsScreenWithFocusTracker', 'Chats tab blurred');
        setIsOnChatsTab(false);
      };
    }, [setIsOnChatsTab])
  );
  return <ChatStack />;
};

// Main Tab Navigator Component
const MainTabNavigator = () => {
  const db = useDatabase();
  const { onMessage } = useWebSocket();
  const [unreadFriendRequests, setUnreadFriendRequests] = useState(0);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [isOnChatsTab, setIsOnChatsTab] = useState(false);
  const [showBadge, setShowBadge] = useState(false); // 是否显示红点（由新消息触发）
  const isOnChatsTabRef = useRef(isOnChatsTab);
  const showBadgeRef = useRef(showBadge);

  logger.info('MainTabNavigator', 'Component rendered, db:', !!db, 'isOnChatsTab:', isOnChatsTab, 'showBadge:', showBadge);

  // 更新 refs
  useEffect(() => {
    isOnChatsTabRef.current = isOnChatsTab;
    showBadgeRef.current = showBadge;
  }, [isOnChatsTab, showBadge]);

  // 获取总未读计数
  const refreshTotalUnreadCount = React.useCallback(async () => {
    if (!db) return;
    try {
      const conversations = await db.collections
        .get<Conversation>('conversations')
        .query()
        .fetch();

      const total = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
      setTotalUnreadCount(total);
      logger.info('MainTabNavigator', 'Total unread count:', total);
    } catch (error) {
      logger.error('MainTabNavigator', 'Error fetching unread count:', error);
    }
  }, [db]);

  // 初始化消息服务和好友申请服务
  useEffect(() => {
    if (!db) {
      logger.warn('MainTabNavigator', 'Database not ready, skipping initialization');
      return;
    }

    logger.info('MainTabNavigator', 'Initializing message services...');

    // 设置数据库实例
    messageService.setDatabase(db);
    friendRequestService.setDatabase(db);

    logger.info('MainTabNavigator', 'Database set for messageService and friendRequestService');

    // 获取初始未读数
    friendRequestService.getUnreadCount().then(setUnreadFriendRequests);
    refreshTotalUnreadCount();

    // 添加好友申请未读数监听器
    const unsubscribeFriendRequestCount = friendRequestService.addUnreadCountListener(setUnreadFriendRequests);

    // 监听新消息，只在不在 Chats 页面时设置角标
    const unsubscribeMessage = messageService.addMessageListener((data) => {
      logger.info('MainTabNavigator', '🔔 New message received, isOnChatsTabRef:', isOnChatsTabRef.current);
      if (!isOnChatsTabRef.current) {
        // 不在 Chats tab，显示红点
        setShowBadge(true);
        // 更新总未读计数
        refreshTotalUnreadCount();
        logger.info('MainTabNavigator', 'Not on Chats tab, showing badge');
      } else {
        logger.info('MainTabNavigator', 'On Chats tab, ignoring message for badge');
      }
    });

    // 启动全局消息监听（处理所有聊天消息）
    logger.info('MainTabNavigator', 'Calling messageService.startListener...');
    messageService.startListener(onMessage);

    // 启动 WebSocket 监听（处理好友申请）
    logger.info('MainTabNavigator', 'Calling friendRequestService.startWebSocketListener...');
    friendRequestService.startWebSocketListener(onMessage);

    logger.info('MainTabNavigator', 'Message services initialized');

    return () => {
      logger.info('MainTabNavigator', 'Cleaning up message services...');
      unsubscribeFriendRequestCount();
      unsubscribeMessage();
      friendRequestService.stopWebSocketListener();
      messageService.stopListener();
    };
  }, [db, onMessage, refreshTotalUnreadCount]);

  // 当切换到 Chats 页面时，清除角标并刷新未读计数
  useEffect(() => {
    if (isOnChatsTab) {
      // 在 Chats 页面，清除红点标记，刷新未读计数（会话列表会显示）
      setShowBadge(false);
      refreshTotalUnreadCount();
      logger.info('MainTabNavigator', 'On Chats tab, cleared badge and refreshed unread count');
    }
  }, [isOnChatsTab]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconText = '';

          if (route.name === 'Chats') {
            iconText = focused ? '💬' : '💬';
          } else if (route.name === 'Contacts') {
            iconText = focused ? '👥' : '👥';
          } else if (route.name === 'Discover') {
            iconText = focused ? '🔍' : '🔍';
          } else if (route.name === 'Profile') {
            iconText = focused ? '👤' : '👤';
          }

          return <Text style={{ fontSize: size, color }}>{iconText}</Text>;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Chats"
        options={{
          title: '消息',
          tabBarBadge: showBadge ? (totalUnreadCount > 0 ? totalUnreadCount : undefined) : undefined,
        }}>
        {() => <ChatsScreenWithFocusTracker setIsOnChatsTab={setIsOnChatsTab} />}
      </Tab.Screen>
      <Tab.Screen
        name="Contacts"
        component={ContactsStack}
        options={{
          title: '通讯录',
          tabBarBadge: unreadFriendRequests > 0 ? unreadFriendRequests : undefined,
        }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{ title: '发现' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ title: '我' }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
});

export default MainTabNavigator;
