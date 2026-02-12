/**
 * Main App Component for EchoEnglish Messaging App
 * Implements WeChat-like interface with chat sessions list
 */

import { StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainTabNavigator from './src/navigation/MainTabNavigator';
import { database } from './src/database';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { useEffect } from 'react';
import { initializeDatabase } from './src/database/initialize';

function App() {
  useEffect(() => {
    // Initialize the database with sample data
    initializeDatabase();
  }, []);

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
});

export default App;