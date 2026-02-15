import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import MainScreen from '../screens/MainScreen';
import ChatDetailScreen from '../screens/ChatDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Chat Stack Navigator to handle chat details
const ChatStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: true}}>
    <Stack.Screen name="MainChat" component={MainScreen} />
    <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
  </Stack.Navigator>
);

// Placeholder components for other tabs
const ContactsScreen = () => (
  <View style={styles.tabContent}>
    <Text>Contacts Screen</Text>
  </View>
);

const DiscoverScreen = () => (
  <View style={styles.tabContent}>
    <Text>Discover Screen</Text>
  </View>
);

const ProfileScreen = () => (
  <View style={styles.tabContent}>
    <Text>Profile Screen</Text>
  </View>
);

// Main Tab Navigator Component
const MainTabNavigator = () => {
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
        component={ContactsScreen}
        options={{ title: '通讯录' }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{ title: '发现' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
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