import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useNavigationState } from '@react-navigation/native';
import MainScreen from '../screens/MainScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { friendRequestService } from '../services/FriendRequestService';
import { messageService } from '../services/MessageService';
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

// Main Tab Navigator Component
const MainTabNavigator = () => {
  const db = useDatabase();
  const { onMessage } = useWebSocket();
  const [unreadFriendRequests, setUnreadFriendRequests] = useState(0);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  logger.info('MainTabNavigator', 'Component rendered, db:', !!db, 'onMessage:', typeof onMessage);

  // 获取当前路由名称，判断是否在 Chats 页面
  const currentRouteName = useNavigationState((state) => {
    if (!state) return '';
    const currentRoute = state.routes[state.index];
    // 如果是 Chats tab，检查子路由
    if (currentRoute.name === 'Chats' && currentRoute.state) {
      const routeIndex = currentRoute.state.index;
      if (routeIndex !== undefined && currentRoute.state.routes[routeIndex]) {
        return currentRoute.state.routes[routeIndex].name;
      }
    }
    return currentRoute.name;
  });

  const isOnChatsTab = currentRouteName === 'MainChat' || currentRouteName === 'ChatDetail';

  // 初始化消息服务和好友申请服务
  useEffect(() => {
    if (!db) {
      logger.warn('MainTabNavigator', 'Database not ready, skipping initialization');
      return;
    }

    logger.info('MainTabNavigator', 'Initializing message services...');
    logger.info('MainTabNavigator', 'onMessage function exists:', typeof onMessage === 'function');

    // 设置数据库实例
    messageService.setDatabase(db);
    friendRequestService.setDatabase(db);

    logger.info('MainTabNavigator', 'Database set for messageService and friendRequestService');

    // 获取初始未读数（延迟执行确保数据库已准备好）
    setTimeout(() => {
      friendRequestService.getUnreadCount().then(setUnreadFriendRequests);
    }, 200);

    // 添加好友申请未读数监听器
    const unsubscribeFriendRequestCount = friendRequestService.addUnreadCountListener(setUnreadFriendRequests);

    // 监听新消息，只在不在 Chats 页面时设置角标
    const unsubscribeMessage = messageService.addMessageListener((data) => {
      logger.info('MainTabNavigator', '🔔 New message received:', JSON.stringify(data));
      // 如果当前不在 Chats 页面，显示角标
      if (!isOnChatsTab) {
        setHasUnreadMessages(true);
        logger.info('MainTabNavigator', 'Not on Chats tab, showing badge');
      }
    });

    // 启动全局消息监听（处理所有聊天消息）
    // 注意：messageService.startListener 有防重复逻辑，只会注册一次
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
  }, [db, onMessage]);

  // 当切换到 Chats 页面时，清除角标
  useEffect(() => {
    if (isOnChatsTab && hasUnreadMessages) {
      console.log('[MainTabNavigator] Switched to Chats tab, hiding badge');
      setHasUnreadMessages(false);
    }
  }, [isOnChatsTab, hasUnreadMessages]);

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
        component={ChatStack}
        options={{
          title: '消息',
          tabBarBadge: hasUnreadMessages ? 1 : undefined,
        }}
      />
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
