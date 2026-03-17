import React, { useState, useRef, useEffect } from 'react';
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
import Turnstile from '../components/Turnstile';
import { TurnstileConfig } from '../config/appConfig';
import { ApiService } from '../services/ApiService';

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

  // 验证码相关状态
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showTurnstile, setShowTurnstile] = useState(false);

  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // 清理倒计时
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  const siteKey = TurnstileConfig.siteKey;

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 发送验证码 - 显示 Turnstile
  const handleSendCodePress = () => {
    if (!email.trim()) {
      Alert.alert('提示', '请输入邮箱');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('提示', '请输入有效的邮箱地址');
      return;
    }

    setShowTurnstile(true);
  };

  // Turnstile 验证成功后发送验证码
  const handleTurnstileVerify = async (token: string) => {
    setShowTurnstile(false);
    setSendingCode(true);

    try {
      await ApiService.sendVerificationCodeForRegister(email.trim(), token);
      setCodeSent(true);
      setCountdown(60);

      // 开始倒计时
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      Alert.alert('成功', '验证码已发送到您的邮箱');
    } catch (error) {
      Alert.alert('发送失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setSendingCode(false);
    }
  };

  const handleTurnstileError = (error: string) => {
    setShowTurnstile(false);
    Alert.alert('验证失败', error || '请稍后重试');
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

    if (!verificationCode.trim()) {
      Alert.alert('提示', '请输入验证码');
      return;
    }

    if (verificationCode.length !== 6) {
      Alert.alert('提示', '验证码为 6 位数字');
      return;
    }

    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password, verificationCode);
      // 注册成功后 AuthContext 会自动设置用户状态，自动跳转到主页
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

            {/* 验证码 */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>验证码</Text>
              <View style={styles.codeRow}>
                <TextInput
                  style={[styles.input, styles.codeInput, { borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder="请输入 6 位验证码"
                  placeholderTextColor={colors.textTertiary}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={[
                    styles.codeButton,
                    { backgroundColor: colors.primary },
                    (sendingCode || countdown > 0 || loading) && { backgroundColor: colors.textDisabled }
                  ]}
                  onPress={handleSendCodePress}
                  disabled={sendingCode || countdown > 0 || loading}
                >
                  <Text style={[styles.codeButtonText, { color: colors.white }]}>
                    {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : '发送验证码'}
                  </Text>
                </TouchableOpacity>
              </View>
              {codeSent && (
                <Text style={[styles.codeHint, { color: colors.textTertiary }]}>
                  验证码已发送到 {email}，10 分钟内有效
                </Text>
              )}
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

      {/* Cloudflare Turnstile 验证 */}
      <Turnstile
        visible={showTurnstile}
        siteKey={siteKey}
        onVerify={handleTurnstileVerify}
        onError={handleTurnstileError}
        onClose={() => setShowTurnstile(false)}
      />
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
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeInput: {
    flex: 1,
    marginRight: 12,
  },
  codeButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minWidth: 110,
    alignItems: 'center',
  },
  codeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  codeHint: {
    fontSize: 12,
    marginTop: 8,
  },
});

export default RegisterScreen;
