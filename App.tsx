/**
 * Main App Component for EchoEnglish Messaging App
 * Implements WeChat-like interface with chat sessions list
 */

import { StatusBar, StyleSheet, View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { NavigationContainer } from '@react-navigation/native';
import { useState, useEffect } from 'react';
import { getDatabase, initDatabase } from './src/database';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { WebSocketProvider } from './src/contexts/WebSocketContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import logger from './src/utils/logger';

// 设置日志级别（生产环境可改为 'info' 或 'warn'）
logger.setLevel('debug'); // 可选值：'debug' | 'info' | 'warn' | 'error'

// 内部组件：根据登录状态渲染不同的内容
const AppContent = () => {
  const { isAuthenticated, user, loading } = useAuth();
  const [currentDb, setCurrentDb] = useState<any>(null);
  const [dbInitializing, setDbInitializing] = useState(false);

  // 监听用户登录，创建专属数据库并同步用户数据
  useEffect(() => {
    const syncUserData = async () => {
      if (isAuthenticated && user) {
        logger.info('App', 'User logged in, initializing database for:', user.id);
        setDbInitializing(true);

        // 初始化数据库
        initDatabase(user.id);
        const db = getDatabase();
        setCurrentDb(db);

        // 同步用户数据到本地数据库
        if (db) {
          try {
            const collection = db.collections.get('users');
            const existingUser = await collection
              .query()
              .fetch()
              .then((users: any[]) => users[0] || null);

            await db.write(async () => {
              if (existingUser) {
                await existingUser.update((u: any) => {
                  u.name = user.name;
                  u.email = user.email;
                  u.avatarUrl = user.avatarUrl ?? undefined;
                });
                logger.info('App', 'Updated existing user:', user.id);
              } else {
                await collection.create((u: any) => {
                  u.userId = user.id;
                  u.name = user.name;
                  u.email = user.email;
                  u.avatarUrl = user.avatarUrl ?? undefined;
                  u.isOnline = true;
                });
                logger.info('App', 'Created new user:', user.id);
              }
            });
          } catch (error) {
            logger.error('App', 'syncUserToLocal error:', error);
          }
        }

        setDbInitializing(false);
      } else if (!isAuthenticated) {
        logger.info('App', 'User logged out, clearing database');
        setCurrentDb(null);
      }
    };

    syncUserData();
  }, [isAuthenticated, user]);

  if (loading || dbInitializing) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </View>
    );
  }

  // 未登录：直接渲染登录页面（无 DatabaseProvider）
  if (!isAuthenticated) {
    return (
      <SafeAreaProvider>
        <KeyboardProvider>
          <NavigationContainer>
            <AuthNavigator />
          </NavigationContainer>
        </KeyboardProvider>
      </SafeAreaProvider>
    );
  }

  // 已登录：渲染主应用（包裹 DatabaseProvider）
  // 确保 currentDb 不为 null
  if (!currentDb) {
    console.warn('[App] User is authenticated but database is not available');
    return null;
  }

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <DatabaseProvider database={currentDb}>
          <WebSocketProvider>
            <RootNavigator />
          </WebSocketProvider>
        </DatabaseProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // 使用新的背景色
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;