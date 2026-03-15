import React, { forwardRef } from 'react';
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
import { useTheme } from '../../../hooks/useTheme';

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
  // Ref 回调，用于获取气泡位置
  onRef?: (ref: View | null) => void;
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
  onRef,
}) => {
  const { colors, spacing, shadows } = useTheme();
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
          style={[
            styles.messageAvatar,
            { marginHorizontal: spacing.xs },
            shadows.avatar
          ]}
          onError={(e) => logger.error('MessageBubble', 'Avatar load error:', e.nativeEvent.error)}
        />
      )}

      {/* Status indicator */}
      {sending && (
        <View style={[styles.statusContainer, { marginHorizontal: spacing.xs }]}>
          <ActivityIndicator size="small" color={colors.textTertiary} />
        </View>
      )}
      {failed && (
        <TouchableOpacity
          style={[styles.statusContainer, { marginHorizontal: spacing.xs }]}
          onPress={onRetry}
        >
          <View style={[styles.failedIcon, { backgroundColor: colors.error }]}>
            <Text style={[styles.failedText, { color: colors.white }]}>!</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Message Bubble */}
      <View
        ref={onRef}
        style={[
          styles.messageBubble,
          {
            backgroundColor: isMe ? colors.messageSent : colors.messageReceived,
            padding: spacing.sm,
            marginVertical: spacing.xs,
            marginHorizontal: spacing.xs,
            borderRadius: 12,
            maxWidth: '70%',
            ...shadows.sm,
          },
          failed && { opacity: 0.8, borderWidth: 1, borderColor: colors.error },
        ]}
      >
        <View style={styles.messageContent}>
          <Text style={[
            styles.messageText,
            styles.messageTextWrap,
            { color: isMe ? colors.messageTextSent : colors.messageTextReceived }
          ]}>
            {text}
          </Text>
        </View>
        {sending && <Text style={[styles.messageStatus, { color: colors.textTertiary }]}>发送中...</Text>}
      </View>

      {/* Avatar for my messages */}
      {isMe && senderAvatar && (
        <Image
          source={{ uri: getAvatarUrl(senderAvatar, 40) }}
          style={[
            styles.messageAvatar,
            { marginHorizontal: spacing.xs },
            shadows.avatar
          ]}
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
  },
  statusContainer: {
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  failedIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  failedText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageBubble: {
    position: 'relative',
  },
  messageContent: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  messageTextWrap: {
    flex: 1,
    flexWrap: 'wrap',
  },
  messageStatus: {
    fontSize: 10,
    marginTop: 4,
  },
});

export default MessageBubble;
