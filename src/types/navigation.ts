import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

// Define the navigation parameters for the chat stack
export type ChatStackParamList = {
  MainChat: undefined;
  ChatDetail: {
    chatId: string;
    chatName: string;
    chatType?: 'direct' | 'group';
  };
  GroupDetail: {
    groupId: string;
    groupName: string;
  };
  SearchUser: undefined;
  FriendRequests: undefined;
  Contacts: undefined;
  CreateGroupChat: undefined;
};

// Define the navigation parameters for the main tab navigator
export type MainTabParamList = {
  Chats: undefined;
  Contacts: undefined;
  Profile: undefined;
};

// Navigation prop types for each screen
export type MainScreenNavigationProp = StackNavigationProp<ChatStackParamList, 'MainChat'>;
export type ContactsScreenNavigationProp = StackNavigationProp<ChatStackParamList, 'Contacts'>;
export type ChatDetailScreenNavigationProp = StackNavigationProp<ChatStackParamList, 'ChatDetail'>;
export type GroupDetailScreenNavigationProp = StackNavigationProp<ChatStackParamList, 'GroupDetail'>;
export type SearchUserScreenNavigationProp = StackNavigationProp<ChatStackParamList, 'SearchUser'>;
export type FriendRequestsScreenNavigationProp = StackNavigationProp<ChatStackParamList, 'FriendRequests'>;
export type ProfileScreenNavigationProp = StackNavigationProp<MainTabParamList, 'Profile'>;
export type CreateGroupChatScreenNavigationProp = StackNavigationProp<ChatStackParamList, 'CreateGroupChat'>;

// Route prop types for screens that receive parameters
export type ChatDetailScreenRouteProp = RouteProp<ChatStackParamList, 'ChatDetail'>;
export type SearchUserScreenRouteProp = RouteProp<ChatStackParamList, 'SearchUser'>;
export type FriendRequestsScreenRouteProp = RouteProp<ChatStackParamList, 'FriendRequests'>;