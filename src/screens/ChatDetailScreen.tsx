import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Platform,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useDerivedValue,
} from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Q } from '@nozbe/watermelondb';
import { Message } from '../database/models';
import { ChatDetailScreenNavigationProp, ChatDetailScreenRouteProp } from '../types/navigation';
import { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';

interface MessageInterface {
  id: string;
  text: string;
  sender: 'me' | 'other';
  timestamp: string;
}

const ChatDetailScreen = () => {
  const navigation = useNavigation<ChatDetailScreenNavigationProp>();
  const route = useRoute<ChatDetailScreenRouteProp>();
  const parentNavigation = useNavigation();
  const tabNavigation = parentNavigation.getParent();
  
  const database = useDatabase();
  // In a real app, you would get the chat ID from route params
  const chatId = route.params.chatId;
  const chatName = route.params.chatName;

  const scrollViewRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();  // 获取键盘动画高度（共享值，平滑动画）

  // 衍生值：键盘高度（用于上推 FlatList）
  const translateY = useDerivedValue(() => {
    return withTiming(keyboardHeight.value, { duration: 0});  // 向上移动，duration 200 为平滑过渡
  });

  // FlatList 的动画样式
  const animatedListStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    console.log("insets.bottom", insets.bottom);
    
    // Hide the tab bar when this screen is active
    if (tabNavigation) {
      tabNavigation.setOptions({
        tabBarStyle: { display: 'none' },
      });
    }
    
    // 设置页面标题和自定义头部
    navigation.setOptions({
      headerShown: true,
      headerStyle: {
        backgroundColor: '#f8f8f8',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
      },
      headerTitle: chatName,
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: 'bold',
      },
      headerLeft: () => (
        <TouchableOpacity
          style={{ paddingLeft: 16 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ fontSize: 24, fontWeight: 'normal' }}>‹</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity style={{ paddingRight: 16 }}>
          <Text style={{ fontSize: 20 }}>⋮</Text>
        </TouchableOpacity>
      ),
    });

    // Cleanup function to restore the tab bar when leaving this screen
    return () => {
      if (tabNavigation) {
        tabNavigation.setOptions({
          tabBarStyle: {} // Restore default tab bar style
        });
      }
    };
  }, [navigation, chatName, tabNavigation]);

  const [messages, setMessages] = useState<MessageInterface[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch messages from the database for this chat
    const fetchMessages = async () => {
      try {
        if (!database) {
          console.error('Database is not available');
          return;
        }
        
        const dbMessages = await database.collections
          .get<Message>('messages')
          .query(
            Q.where('chat_session_id', chatId),
            Q.sortBy('timestamp', Q.desc)
          )
          .fetch();

        // Convert database records to the format expected by the UI
        const formattedMessages = dbMessages.map(msg => {
          const sender: 'me' | 'other' = msg.senderId === 'current_user_id' ? 'me' : 'other'; // In a real app, you'd have the current user ID
          return {
            id: msg.id,
            text: msg.text,
            sender,
            timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
        });

        setMessages(formattedMessages);
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoading(false);
      }
    };

    if (database) {
      fetchMessages();

      // Set up a subscription to listen for changes in the database
      const subscription = database.collections
        .get<Message>('messages')
        .query(
          Q.where('chat_session_id', chatId),
          Q.sortBy('timestamp', Q.desc)
        )
        .observe()
        .subscribe((dbMessages) => {
          const formattedMessages = dbMessages.map(msg => {
            const sender: 'me' | 'other' = msg.senderId === 'current_user_id' ? 'me' : 'other'; // In a real app, you'd have the current user ID
            return {
              id: msg.id,
              text: msg.text,
              sender,
              timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
          });

          setMessages(formattedMessages);
        });

      // Clean up subscription when component unmounts
      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }
  }, [database, chatId]);

  const handleSendMessage = async () => {
    if (inputText.trim() === '' || !database) return;

    try {
      // Create a new message in the database
      const newMessage = await database.write(async () => {
        return database.collections.get<Message>('messages').create(message => {
          message.text = inputText;
          message.senderId = 'current_user_id'; // In a real app, you'd have the current user ID
          message.chatSessionId = chatId;
          message.status = 'sent';
          message.timestamp = Date.now();
        });
      });

      // Clear the input
      setInputText('');
      
      // The message will appear in the list due to the subscription
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 渲染单条消息的函数
  const renderMessage = ({ item }: { item: MessageInterface }) => (
    <View
      style={[
        styles.messageBubble,
        item.sender === 'me' ? styles.myMessage : styles.otherMessage
      ]}
    >
      <Text style={[
        styles.messageText,
        item.sender === 'me' ? styles.myMessageText : styles.otherMessageText
      ]}>
        {item.text}
      </Text>
      <Text style={styles.messageTime}>{item.timestamp}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 用 Animated.View 包裹 FlatList，实现平滑上推 */}
      <Animated.View style={[styles.messagesWrapper, animatedListStyle]}>
        <FlatList
          ref={scrollViewRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted // 最新的消息在底部
          style={styles.messagesContainer}
          contentContainerStyle={[
            styles.flatListContent,
            { paddingBottom: 20 }  // 底部留间距，避免紧贴输入区
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            // 当内容改变时，自动滚动到底部（即最新消息，因为是inverted）
            const scrollRef = scrollViewRef.current;
            if (scrollRef && typeof scrollRef.scrollToOffset === 'function') {
              // 滚动到顶部，因为列表是倒置的
              scrollRef.scrollToOffset({ offset: 0, animated: true });
            }
          }}
        />
      </Animated.View>

      {/* 输入区：保持 KeyboardStickyView 粘附键盘顶部 */}
      <KeyboardStickyView 
        offset={{ 
          closed: 0, 
          opened: 0  // 全屏模式下推荐 0（紧贴），或 -20 留间距
        }}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="输入消息..."
            multiline
            value={inputText}
            onChangeText={setInputText}
            blurOnSubmit={false}
            onFocus={() => {
              // 键盘打开时，滚动到最新消息
              setTimeout(() => {
                const scrollRef = scrollViewRef.current;
                if (scrollRef && typeof scrollRef.scrollToOffset === 'function') {
                  // 滚动到顶部，因为列表是倒置的
                  scrollRef.scrollToOffset({ offset: 0, animated: true });
                }
              }, 200); // 增加延迟以确保动画完成
            }}
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
            <Text style={styles.sendButtonText}>发送</Text>
          </TouchableOpacity>
        </View>
      </KeyboardStickyView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  messagesWrapper: {
    flex: 1,  // 占满可用空间
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  scrollViewContent: {
    paddingBottom: 10,
  },
  flatListContent: {
    paddingVertical: 10,
  },
  inputContainerWrapper: {
    // 包装输入容器，便于动画处理
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 10,
    marginVertical: 5,
    borderRadius: 10,
    position: 'relative',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#333333',
  },
  messageTime: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'right',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 5,
    backgroundColor: '#f8f8f8',
    // borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    marginRight: 10,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

export default ChatDetailScreen;