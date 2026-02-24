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
import Turnstile from '../components/Turnstile';
import { TurnstileConfig } from '../config/appConfig';
import { API_CONFIG } from '../config/constants';

interface VerifyEmailScreenProps {
  navigation: any;
  route: {
    params?: {
      email?: string;
    };
  };
}

const VerifyEmailScreen = ({ navigation, route }: VerifyEmailScreenProps) => {
  const { user, login } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(route.params?.email || '');
  const [password, setPassword] = useState('');
  const isFromRegister = !!route.params?.email;

  // Turnstile 相关状态
  const [showTurnstile, setShowTurnstile] = useState(false);

  // 使用配置文件中的 site key
  const siteKey = TurnstileConfig.siteKey;
  const apiUrl = API_CONFIG.BASE_URL;

  const handleVerify = async () => {
    if (!code.trim()) {
      Alert.alert('提示', '请输入验证码');
      return;
    }

    if (code.length !== 6) {
      Alert.alert('提示', '验证码为 6 位数字');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/email-verification/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email || user?.email,
          code,
        }),
      });

      const data: any = await response.json();

      if (response.ok && data.success) {
        Alert.alert(
          '验证成功',
          '邮箱验证成功！',
          [
            {
              text: '确定',
              onPress: () => {
                // 如果是从注册流程来的，需要登录
                if (isFromRegister) {
                  navigation.navigate('Login');
                } else {
                  // 否则返回上一页
                  navigation.goBack();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('验证失败', data.error || '验证码错误，请重试');
      }
    } catch (error: any) {
      Alert.alert('验证失败', error.message || '请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = () => {
    // 显示 Turnstile 验证
    setShowTurnstile(true);
  };

  const handleTurnstileVerify = async (token: string) => {
    console.log('Turnstile token:', token);
    // 验证成功后发送验证码
    setShowTurnstile(false);
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/email-verification/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email || user?.email,
          hcaptcha_token: token,
        }),
      });

      const data: any = await response.json();

      if (response.ok && data.success) {
        Alert.alert('成功', '验证码已重新发送，请查看邮箱');
      } else {
        Alert.alert('失败', data.error || '请稍后重试');
      }
    } catch (error: any) {
      Alert.alert('失败', error.message || '请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleTurnstileError = (error: string) => {
    console.error('Turnstile error:', error);
    Alert.alert('错误', error || '人机验证失败，请重试');
  };

  const handleSkip = () => {
    Alert.alert(
      '提示',
      '为了账号安全，请验证您的邮箱。验证码已发送到您的邮箱，请查收。'
    );
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
          {/* 标题 */}
          <View style={styles.header}>
            <Text style={styles.icon}>📧</Text>
            <Text style={styles.title}>验证邮箱</Text>
            <Text style={styles.subtitle}>
              {isFromRegister 
                ? `我们已向 ${email} 发送了 6 位验证码`
                : `我们已向 ${user?.email} 发送了 6 位验证码`
              }
            </Text>
            <Text style={styles.hint}>
              验证码 10 分钟内有效
            </Text>
          </View>

          {/* 验证码输入 */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>验证码</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="请输入 6 位验证码"
                placeholderTextColor="#999"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
              onPress={handleVerify}
              disabled={loading}
            >
              <Text style={styles.verifyButtonText}>
                {loading ? '验证中...' : '验证邮箱'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResendCode}
              disabled={loading}
            >
              <Text style={styles.resendButtonText}>
                重新发送验证码
              </Text>
            </TouchableOpacity>

            {/* 跳过按钮 */}
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
              disabled={loading}
            >
              <Text style={styles.skipButtonText}>
                未收到验证码？
              </Text>
            </TouchableOpacity>
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
  icon: {
    fontSize: 60,
    marginBottom: 16,
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
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#999',
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
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: 'bold',
  },
  verifyButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  verifyButtonDisabled: {
    backgroundColor: '#99C9FF',
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  resendButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  skipButtonText: {
    color: '#999',
    fontSize: 14,
  },
  captchaModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captchaContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  captchaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  captchaSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  captchaCloseButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 40,
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
  },
  captchaCloseButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VerifyEmailScreen;
