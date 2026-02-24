import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { SearchUserScreenNavigationProp } from '../types/navigation';
import { API_CONFIG } from '../config/constants';
import { database } from '../database';
import AuthToken from '../database/models/AuthToken';
import { Q } from '@nozbe/watermelondb';

interface SearchResult {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

// 获取 Token
const getAuthToken = async (): Promise<string | null> => {
  try {
    const tokens = await database.collections.get<AuthToken>('auth_tokens').query().fetch();
    if (tokens.length > 0) {
      return tokens[0].accessToken;
    }
    return null;
  } catch (error) {
    console.error('[SearchUser] Get token error:', error);
    return null;
  }
};

const SearchUserScreen = () => {
  const navigation = useNavigation<SearchUserScreenNavigationProp>();
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  const handleSearch = async () => {
    if (!searchEmail.trim()) {
      Alert.alert('提示', '请输入邮箱地址');
      return;
    }

    setLoading(true);
    try {
      const token = await getAuthToken();

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/friends/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: searchEmail.trim(),
        }),
      });

      const data: any = await response.json();

      if (response.ok && data.success) {
        setSearchResult(data.data.user);
      } else {
        setSearchResult(null);
        Alert.alert('搜索结果', data.error || '未找到该用户');
      }
    } catch (error: any) {
      Alert.alert('搜索失败', error.message || '请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult) return;

    setSendingRequest(true);
    try {
      const token = await getAuthToken();

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/friends/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          receiverId: searchResult.id,
          message: requestMessage,
        }),
      });

      const data: any = await response.json();

      if (response.ok && data.success) {
        Alert.alert(
          '发送成功',
          '好友请求已发送，等待对方确认',
          [
            {
              text: '确定',
              onPress: () => {
                setShowModal(false);
                setSearchResult(null);
                setSearchEmail('');
                setRequestMessage('');
              },
            },
          ]
        );
      } else {
        Alert.alert('发送失败', data.error || '请稍后重试');
      }
    } catch (error: any) {
      Alert.alert('发送失败', error.message || '请稍后重试');
    } finally {
      setSendingRequest(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 搜索框 */}
          <View style={styles.searchContainer}>
            <Text style={styles.label}>搜索用户</Text>
            <View style={styles.searchInputContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="请输入邮箱地址"
                placeholderTextColor="#999"
                value={searchEmail}
                onChangeText={setSearchEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity
                style={[styles.searchButton, loading && styles.searchButtonDisabled]}
                onPress={handleSearch}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.searchButtonText}>搜索</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 搜索结果 */}
          {searchResult && (
            <View style={styles.resultContainer}>
              <Text style={styles.resultTitle}>搜索结果</Text>
              <TouchableOpacity
                style={styles.resultItem}
                onPress={() => setShowModal(true)}
              >
                <View style={styles.avatarContainer}>
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>{searchResult.name.charAt(0)}</Text>
                  </View>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{searchResult.name}</Text>
                  <Text style={styles.userEmail}>{searchResult.email}</Text>
                </View>
                <Text style={styles.addIcon}>+</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 发送好友请求模态框 */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>发送好友请求</Text>

            {searchResult && (
              <View style={styles.targetUser}>
                <Text style={styles.targetUserLabel}>发送给：</Text>
                <Text style={styles.targetUserName}>{searchResult.name}</Text>
                <Text style={styles.targetUserEmail}>({searchResult.email})</Text>
              </View>
            )}

            <Text style={styles.messageLabel}>验证消息（可选）</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="介绍一下自己吧..."
              placeholderTextColor="#999"
              value={requestMessage}
              onChangeText={setRequestMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowModal(false)}
                disabled={sendingRequest}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.sendButton, sendingRequest && styles.sendButtonDisabled]}
                onPress={handleSendRequest}
                disabled={sendingRequest}
              >
                {sendingRequest ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>发送请求</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  searchContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
  },
  searchButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#99C9FF',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    marginTop: 10,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  addIcon: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  targetUser: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  targetUserLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  targetUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  targetUserEmail: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  messageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    backgroundColor: '#f8f8f8',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: '#007AFF',
  },
  sendButtonDisabled: {
    backgroundColor: '#99C9FF',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SearchUserScreen;
