import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { getAvatarUrl } from '../../../utils/avatar';
import logger from '../../../utils/logger';

export interface MessageBubbleProps {
  id: string;
  msgId?: string;
  text: string;
  sender: 'me' | 'other';
  senderId?: string;
  senderAvatar?: string;
  timestamp: string;
  sending?: boolean;
  failed?: boolean;
  onLongPress?: () => void;
  onRetry?: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  text,
  sender,
  senderAvatar,
  timestamp,
  sending,
  failed,
  onLongPress,
  onRetry,
}) => {
  const isMe = sender === 'me';

  return (
    <TouchableOpacity
      style={[
        styles.messageRow,
        isMe ? styles.myMessageRow : styles.otherMessageRow
      ]}
      onLongPress={onLongPress}
      activeOpacity={1}
    >
      {/* Avatar for other's messages */}
      {!isMe && senderAvatar && (
        <Image
          source={{ uri: getAvatarUrl(senderAvatar, 40) }}
          style={styles.messageAvatar}
          onError={(e) => logger.error('MessageBubble', 'Avatar load error:', e.nativeEvent.error)}
        />
      )}

      {/* Status indicator */}
      {sending && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color="#999" />
        </View>
      )}
      {failed && (
        <TouchableOpacity
          style={styles.statusContainer}
          onPress={onRetry}
        >
          <View style={styles.failedIcon}>
            <Text style={styles.failedText}>!</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Message Bubble */}
      <View
        style={[
          styles.messageBubble,
          isMe ? styles.myMessage : styles.otherMessage,
          failed && styles.failedMessage
        ]}
      >
        <View style={styles.messageContent}>
          <Text style={[
            styles.messageText,
            styles.messageTextWrap,
            isMe ? styles.myMessageText : styles.otherMessageText
          ]}>
            {text}
          </Text>
        </View>
        {sending && <Text style={styles.messageStatus}>发送中...</Text>}
        {failed && <Text style={styles.failedStatus}>点击重试</Text>}
      </View>

      {/* Avatar for my messages */}
      {isMe && senderAvatar && (
        <Image
          source={{ uri: getAvatarUrl(senderAvatar, 40) }}
          style={styles.messageAvatar}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  statusContainer: {
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  failedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  failedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageBubble: {
    maxWidth: '70%',
    padding: 12,
    marginVertical: 5,
    marginHorizontal: 4,
    borderRadius: 12,
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
  failedMessage: {
    opacity: 0.8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  messageContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
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
  messageTextWrap: {
    flex: 1,
    flexWrap: 'wrap',
  },
  messageStatus: {
    fontSize: 10,
    color: '#999999',
    marginTop: 4,
  },
  failedStatus: {
    fontSize: 10,
    color: '#FF3B30',
    marginLeft: 5,
  },
});

export default MessageBubble;
