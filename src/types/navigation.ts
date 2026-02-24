import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

// Define the navigation parameters for the chat stack
export type ChatStackParamList = {
  MainChat: undefined;
  ChatDetail: {
    chatId: string;
    chatName: string;
    chatType?: 'direct' | 'group'; // 新增：聊天类型
  };
  SearchUser: undefined;
  FriendRequests: undefined;
};

// Navigation prop types for each screen
export type MainScreenNavigationProp = StackNavigationProp<ChatStackParamList, 'MainChat'>;
export type ChatDetailScreenNavigationProp = StackNavigationProp<ChatStackParamList, 'ChatDetail'>;
export type SearchUserScreenNavigationProp = StackNavigationProp<ChatStackParamList, 'SearchUser'>;
export type FriendRequestsScreenNavigationProp = StackNavigationProp<ChatStackParamList, 'FriendRequests'>;

// Route prop types for screens that receive parameters
export type ChatDetailScreenRouteProp = RouteProp<ChatStackParamList, 'ChatDetail'>;
export type SearchUserScreenRouteProp = RouteProp<ChatStackParamList, 'SearchUser'>;
export type FriendRequestsScreenRouteProp = RouteProp<ChatStackParamList, 'FriendRequests'>;