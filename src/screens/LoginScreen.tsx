import React, { useState, useEffect } from 'react';
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
import { ApiService } from '../services/ApiService';
import { StackNavigationProp } from '@react-navigation/stack';
import { useTheme } from '../hooks/useTheme';

type LoginStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string };
};

type LoginScreenNavigationProp = StackNavigationProp<LoginStackParamList, 'Login'>;

const LoginScreen = ({ navigation }: { navigation: LoginScreenNavigationProp }) => {
  const { user, login, loading: authLoading } = useAuth();
  const { colors, spacing, typography, shadows } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // 监听用户状态变化
  useEffect(() => {
    console.log('[LoginScreen] useEffect - user:', user ? { id: user.id, email: user.email } : null, 'authLoading:', authLoading);
    if (user && !authLoading) {
      console.log('[LoginScreen] User is logged in, replacing to Main');
      // Navigate to parent navigator's MainChat
      const parentNav = navigation.getParent();
      if (parentNav) {
        parentNav.navigate('MainChat');
      }
    }
  }, [user, authLoading]);

  // 组件加载时打印状态
  useEffect(() => {
    console.log('[LoginScreen] Component mounted, initial user:', user ? { id: user.id } : null);
    return () => {
      console.log('[LoginScreen] Component will unmount');
    };
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('提示', '请输入邮箱和密码');
      return;
    }

    setLoginLoading(true);
    try {
      // 调用登录接口
      const data = await ApiService.login(email.trim(), password);

      // 登录成功，保存 token
      await login(email.trim(), password);
      // 登录成功后会自动进入主页面（由 AuthContext 的 user 状态控制）
    } catch (error: unknown) {
      // 检查是否是邮箱未验证错误
      if (error instanceof Error && error.message === 'Email not verified') {
        Alert.alert(
          '邮箱未验证',
          '请先验证您的邮箱，验证码已发送到您的邮箱。',
          [
            {
              text: '去验证',
              onPress: () => {
                navigation.navigate('VerifyEmail', { email: email.trim() });
              },
            },
          ]
        );
      } else {
        Alert.alert('登录失败', error instanceof Error ? error.message : '请稍后重试');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginLoading(true);
    try {
      // TODO: 实现 Google Sign-In
      // 这是示例代码，需要配置 @react-native-google-signin/google-signin
      Alert.alert('提示', 'Google 登录功能需要配置，请参考文档完成配置');
      // const userInfo = await GoogleSignin.signIn();
      // await loginWithGoogle(userInfo.data.user);
    } catch (error: unknown) {
      Alert.alert('Google 登录失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setLoginLoading(false);
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
          {/* Logo 和标题 */}
          <View style={[styles.header, { marginBottom: spacing['3xl'] }]}>
            <View style={[styles.logoContainer, { backgroundColor: colors.primary, borderRadius: 40, marginBottom: spacing.md }]}>
              <Text style={styles.logoText}>💬</Text>
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>EchoEnglish</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>智能英语聊天助手</Text>
          </View>

          {/* 登录表单 */}
          <View style={styles.form}>
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
                editable={!loginLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>密码</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="请输入密码"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loginLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: colors.primary }, loginLoading && { backgroundColor: colors.textDisabled }]}
              onPress={handleLogin}
              disabled={loginLoading}
            >
              <Text style={[styles.loginButtonText, { color: colors.white }]}>
                {loginLoading ? '登录中...' : '登录'}
              </Text>
            </TouchableOpacity>

            {/* 分隔线 */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textTertiary }]}>或</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Google 登录按钮 */}
            <TouchableOpacity
              style={[styles.googleButton, { borderColor: colors.border }, loginLoading && { opacity: 0.5 }]}
              onPress={handleGoogleLogin}
              disabled={loginLoading}
            >
              <Text style={[styles.googleButtonText, { color: colors.textPrimary }]}>G</Text>
              <Text style={[styles.googleButtonText, { color: colors.textPrimary }]}>使用 Google 账号登录</Text>
            </TouchableOpacity>

            {/* 注册链接 */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.textSecondary }]}>还没有账号？</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={[styles.registerLink, { color: colors.primary }]}>立即注册</Text>
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
    backgroundColor: '#ffffff',
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
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#333',
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
  loginButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 10,
  },
  googleButtonDisabled: {
    opacity: 0.5,
  },
  googleButtonText: {
    fontSize: 16,
    marginHorizontal: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default LoginScreen;
