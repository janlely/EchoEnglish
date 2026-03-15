/**
 * GroupDissolvedNotice - 群聊解散提示组件
 *
 * 显示在消息列表底部，提示用户本群已解散
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const GroupDissolvedNotice: React.FC = () => (
  <View style={styles.noticeContainer}>
    <Text style={styles.noticeText}>本群已解散</Text>
  </View>
);

const styles = StyleSheet.create({
  noticeContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
  },
  noticeText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default GroupDissolvedNotice;
