/**
 * Main App Component for EchoEnglish Messaging App
 * Implements WeChat-like interface with chat sessions list
 */

import { StatusBar, StyleSheet, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainTabNavigator from './src/navigation/MainTabNavigator';
import { database } from './src/database';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { useEffect, useState } from 'react';
import { initializeDatabase } from './src/database/initialize';

function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    // Initialize the database with sample data
    const initDb = async () => {
      await initializeDatabase();
      setDbReady(true);
    };
    
    initDb();
  }, []);

  if (!dbReady) {
    // Optionally render a loading screen while the database initializes
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <DatabaseProvider database={database}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
          <View style={styles.container}>
            <MainTabNavigator />
          </View>
        </NavigationContainer>
      </SafeAreaProvider>
    </DatabaseProvider>
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