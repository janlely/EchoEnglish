/**
 * ChatMessagesList - 消息列表组件
 * 
 * 负责：
 * - 渲染消息列表（FlatList）
 * - 消息长按选择
 * - 自动滚动到最新消息
 */

import React, { useRef } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { MessageInterface } from '../types';
import MessageBubble from './MessageBubble';

interface ChatMessagesListProps {
  messages: MessageInterface[];
  onMessageLongPress: (message: { id: string; msgId: string; text: string }) => void;
  onMessageRetry: (message: MessageInterface) => void;
}

const ChatMessagesList: React.FC<ChatMessagesListProps> = ({
  messages,
  onMessageLongPress,
  onMessageRetry,
}) => {
  const scrollViewRef = useRef<FlatList>(null);

  /**
   * 渲染单条消息
   */
  const renderMessage = ({ item }: { item: MessageInterface }) => (
    <MessageBubble
      id={item.id}
      msgId={item.msgId}
      text={item.text}
      sender={item.sender}
      senderId={item.senderId}
      senderAvatar={item.senderAvatar}
      timestamp={item.timestamp}
      sending={item.sending}
      failed={item.failed}
      onLongPress={() => {
        onMessageLongPress({ id: item.id, msgId: item.msgId || '', text: item.text });
      }}
      onRetry={() => onMessageRetry(item)}
    />
  );

  return (
    <FlatList
      ref={scrollViewRef}
      data={messages}
      renderItem={renderMessage}
      keyExtractor={(item) => item.id}
      inverted
      style={styles.messagesContainer}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => {
        // 内容改变时滚动到最新消息（顶部，因为列表是倒置的）
        const scrollRef = scrollViewRef.current;
        if (scrollRef && typeof scrollRef.scrollToOffset === 'function') {
          scrollRef.scrollToOffset({ offset: 0, animated: true });
        }
      }}
    />
  );
};

const styles = StyleSheet.create({
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  contentContainer: {
    paddingVertical: 10,
    paddingBottom: 20,
  },
});

export default ChatMessagesList;
