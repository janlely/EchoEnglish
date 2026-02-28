import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { ProfileScreenNavigationProp } from '../types/navigation';
import AvatarCropper from '../components/AvatarCropper';
import { uploadAvatar } from '../api/user';
import { getDisplayAvatarUrl, downloadAndSaveAvatar } from '../utils/avatar';

const ProfileScreen = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, updateUser, logout } = useAuth();
  const [showCropper, setShowCropper] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      '确认退出',
      '确定要退出登录吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '退出',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleAvatarPress = () => {
    setShowCropper(true);
  };

  const handleAvatarCropped = async (uri: string) => {
    setUploading(true);
    try {
      const result = await uploadAvatar(uri);
      console.log('[ProfileScreen] Avatar uploaded:', result.avatarUrl);

      // Download and save avatar locally
      let localPath: string | undefined;
      try {
        localPath = await downloadAndSaveAvatar(result.avatarUrl, user!.id);
        console.log('[ProfileScreen] Avatar saved locally:', localPath);
      } catch (downloadError) {
        console.warn('[ProfileScreen] Failed to save avatar locally:', downloadError);
        // Continue even if local save fails - we still have the remote URL
      }

      // Update user with both remote URL and local path
      updateUser({
        avatarUrl: result.avatarUrl,
        localAvatarPath: localPath,
      });

      Alert.alert('成功', '头像已更新');
    } catch (error: any) {
      Alert.alert('上传失败', error.message || '请稍后重试');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={handleAvatarPress} disabled={uploading}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: getDisplayAvatarUrl(user?.localAvatarPath, user?.avatarUrl) }}
              style={styles.avatar}
            />
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.name || '用户'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
        </View>
      </View>

      {/* Menu Items */}
      <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
        <Text style={styles.menuItemText}>个人设置</Text>
        <Text style={styles.menuItemArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
        <Text style={styles.menuItemText}>消息设置</Text>
        <Text style={styles.menuItemArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
        <Text style={styles.menuItemText}>隐私设置</Text>
        <Text style={styles.menuItemArrow}>›</Text>
      </TouchableOpacity>

      {/* Logout Button */}
      <TouchableOpacity style={[styles.menuItem, styles.logoutButton]} onPress={handleLogout}>
        <Text style={[styles.menuItemText, styles.logoutText]}>退出登录</Text>
      </TouchableOpacity>

      {/* Avatar Cropper Modal */}
      <AvatarCropper
        visible={showCropper}
        onClose={() => setShowCropper(false)}
        onAvatarCropped={handleAvatarCropped}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    marginTop: 10,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  menuItemArrow: {
    fontSize: 20,
    color: '#999',
  },
  logoutButton: {
    marginTop: 20,
  },
  logoutText: {
    color: '#FF3B30',
    textAlign: 'center',
  },
});

export default ProfileScreen;