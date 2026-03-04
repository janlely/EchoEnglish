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
import { useTheme } from '../hooks/useTheme';

const ProfileScreen = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { colors, spacing, typography, shadows } = useTheme();
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Profile Header */}
      <View style={[styles.profileHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border, padding: spacing.lg }]}>
        <TouchableOpacity onPress={handleAvatarPress} disabled={uploading}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: getDisplayAvatarUrl(user?.localAvatarPath, user?.avatarUrl) }}
              style={styles.avatar}
            />
            {uploading && (
              <View style={[styles.uploadingOverlay, { backgroundColor: colors.overlay }]}>
                <ActivityIndicator size="small" color={colors.white} />
              </View>
            )}
          </View>
        </TouchableOpacity>
        <View style={[styles.userInfo, { marginLeft: spacing.md }]}>
          <Text style={[styles.userName, { color: colors.textPrimary, ...typography.title3 }]}>
            {user?.name || '用户'}
          </Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
            {user?.email || ''}
          </Text>
        </View>
      </View>

      {/* Menu Items */}
      <TouchableOpacity 
        style={[styles.menuItem, { backgroundColor: colors.surface, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.sm }]}
        onPress={() => {}}
      >
        <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>{'个人设置'}</Text>
        <Text style={[styles.menuItemArrow, { color: colors.textTertiary }]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, { backgroundColor: colors.surface, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.sm }]}
        onPress={() => {}}
      >
        <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>{'消息设置'}</Text>
        <Text style={[styles.menuItemArrow, { color: colors.textTertiary }]}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.menuItem, { backgroundColor: colors.surface, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.sm }]}
        onPress={() => {}}
      >
        <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>{'隐私设置'}</Text>
        <Text style={[styles.menuItemArrow, { color: colors.textTertiary }]}>›</Text>
      </TouchableOpacity>

      {/* Logout Button */}
      <TouchableOpacity 
        style={[styles.menuItem, styles.logoutButton, { backgroundColor: colors.surface, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.lg }]}
        onPress={handleLogout}
      >
        <Text style={[styles.menuItemText, styles.logoutText, { color: colors.error }]}>{'退出登录'}</Text>
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
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
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
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
  },
  menuItemArrow: {
    fontSize: 20,
  },
  logoutButton: {
    marginTop: 20,
  },
  logoutText: {
    textAlign: 'center',
  },
});

export default ProfileScreen;