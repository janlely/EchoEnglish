import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import MainTabNavigator from './MainTabNavigator';
import ChatDetailScreen from '../screens/ChatDetailScreen';
import SearchUserScreen from '../screens/SearchUserScreen';
import FriendRequestsScreen from '../screens/FriendRequestsScreen';

const Stack = createStackNavigator();

const RootNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabNavigator} />
        <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />
        <Stack.Screen name="SearchUser" component={SearchUserScreen} />
        <Stack.Screen 
          name="FriendRequests" 
          component={FriendRequestsScreen}
          options={{
            headerShown: true,
            headerTitle: '好友请求',
            headerStyle: {
              backgroundColor: '#f8f8f8',
            },
            headerTitleStyle: {
              fontSize: 18,
              fontWeight: 'bold',
            },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
