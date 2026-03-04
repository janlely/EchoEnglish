import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useWebSocket } from '../contexts/WebSocketContext';
import MainScreen from '../screens/MainScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { friendRequestService } from '../services/FriendRequestService';

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

  // 初始化好友申请服务并监听未读数
  useEffect(() => {
    if (!db) {
      return;
    }

    // 设置数据库
    friendRequestService.setDatabase(db);

    // 获取初始未读数（延迟执行确保数据库已准备好）
    setTimeout(() => {
      friendRequestService.getUnreadCount().then(setUnreadFriendRequests);
    }, 200);

    // 添加未读数监听器
    const unsubscribeCount = friendRequestService.addUnreadCountListener(setUnreadFriendRequests);

    // 启动 WebSocket 监听
    friendRequestService.startWebSocketListener(onMessage);

    return () => {
      unsubscribeCount();
      friendRequestService.stopWebSocketListener();
    };
  }, [db, onMessage]);

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
        options={{ title: '消息' }}
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
