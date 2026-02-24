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
import { database, getDatabase, initDatabase } from './src/database';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { WebSocketProvider } from './src/contexts/WebSocketContext';
import RootNavigator from './src/navigation/RootNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';

// 内部组件：根据登录状态渲染不同的内容
const AppContent = () => {
  const { isAuthenticated, user, loading } = useAuth();
  const [currentDb, setCurrentDb] = useState<any>(database);
  const [dbReady, setDbReady] = useState(false);

  // Initialize database on mount
  useEffect(() => {
    setDbReady(true);
  }, []);

  // 监听用户登录，创建专属数据库
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('[App] User logged in, initializing database for:', user.id);
      initDatabase(user.id);
      setCurrentDb(getDatabase());
    } else if (!isAuthenticated) {
      console.log('[App] User logged out, clearing database');
      setCurrentDb(database); // 返回默认数据库
    }
  }, [isAuthenticated, user]);

  // 监听数据库实例变化
  useEffect(() => {
    const checkDbChange = setInterval(() => {
      const db = getDatabase();
      if (db && db !== currentDb) {
        setCurrentDb(db);
        console.log('[App] Database instance changed');
      }
    }, 1000);

    return () => clearInterval(checkDbChange);
  }, [currentDb]);

  if (loading || !dbReady) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;