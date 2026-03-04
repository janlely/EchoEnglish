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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTheme } from '../hooks/useTheme';

type RegisterStackParamList = {
  Register: undefined;
  Login: undefined;
};

type RegisterScreenNavigationProp = StackNavigationProp<RegisterStackParamList, 'Register'>;

const RegisterScreen = ({ navigation }: { navigation: RegisterScreenNavigationProp }) => {
  const { register } = useAuth();
  const { colors, spacing, typography } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRegister = async () => {
    // 验证输入
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('提示', '请填写所有必填项');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('提示', '请输入有效的邮箱地址');
      return;
    }

    if (password.length < 6) {
      Alert.alert('提示', '密码长度至少为 6 位');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('提示', '两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);

      // 注册成功，跳转到登录页面
      Alert.alert(
        '注册成功',
        '请登录您的账号',
        [
          {
            text: '确定',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (error: unknown) {
      Alert.alert('注册失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 标题 */}
          <View style={[styles.header, { marginBottom: spacing['3xl'] }]}>
            <Text style={[styles.title, { color: colors.textPrimary, ...typography.title1 }]}>创建账号</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>注册后即可开始使用 EchoEnglish</Text>
          </View>

          {/* 注册表单 */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>昵称</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="请输入昵称"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>邮箱</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="请输入邮箱"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>密码</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="请输入密码（至少 6 位）"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>确认密码</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="请再次输入密码"
                placeholderTextColor={colors.textTertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.registerButton, { backgroundColor: colors.primary }, loading && { backgroundColor: colors.textDisabled }]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={[styles.registerButtonText, { color: colors.white }]}>
                {loading ? '注册中...' : '注册'}
              </Text>
            </TouchableOpacity>

            {/* 登录链接 */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>已有账号？</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={[styles.loginLink, { color: colors.primary }]}>立即登录</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  registerButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  registerButtonDisabled: {
    opacity: 0.5,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default RegisterScreen;
