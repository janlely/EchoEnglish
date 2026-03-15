/**
 * ChatInput - 输入框组件
 *
 * 负责：
 * - 消息输入框
 * - 发送按钮
 * - 长按触发翻译
 * - 键盘打开时滚动到最新消息
 */

import React, { useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, FlatList } from 'react-native';

interface ChatInputProps {
  inputText: string;
  onTextChange: (text: string) => void;
  onSend: () => void;
  onLongPress: () => void;
  onKeyboardFocus: () => void;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  onTextChange,
  onSend,
  onLongPress,
  onKeyboardFocus,
  disabled = false,
}) => {
  return (
    <View style={styles.inputContainer}>
      <TextInput
        style={[styles.textInput, disabled && styles.textInputDisabled]}
        placeholder={disabled ? '群已解散，无法发送消息' : '输入消息...'}
        placeholderTextColor={disabled ? '#999' : '#ccc'}
        multiline
        value={inputText}
        onChangeText={onTextChange}
        blurOnSubmit={false}
        onFocus={onKeyboardFocus}
        editable={!disabled}
      />
      <TouchableOpacity
        style={[styles.sendButton, disabled && styles.sendButtonDisabled]}
        onPress={onSend}
        onLongPress={onLongPress}
        delayLongPress={500}
        disabled={disabled}
      >
        <Text style={styles.sendButtonText}>发送</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 5,
    backgroundColor: '#f8f8f8',
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
  textInputDisabled: {
    backgroundColor: '#f0f0f0',
    color: '#999',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

export default ChatInput;
