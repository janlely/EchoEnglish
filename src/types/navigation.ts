import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';

// Define the navigation parameters for the chat stack
export type ChatStackParamList = {
  MainChat: undefined;
  ChatDetail: {
    chatId: string;
    chatName: string;
  };
};

// Navigation prop types for each screen
export type MainScreenNavigationProp = StackNavigationProp<ChatStackParamList, 'MainChat'>;
export type ChatDetailScreenNavigationProp = StackNavigationProp<ChatStackParamList, 'ChatDetail'>;

// Route prop types for screens that receive parameters
export type ChatDetailScreenRouteProp = RouteProp<ChatStackParamList, 'ChatDetail'>;