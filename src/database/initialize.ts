import { database } from './index';

// Initialize the database - no sample data, starts empty
// Real data will be loaded from the server via API
export const initializeDatabase = async () => {
  try {
    // Database starts empty - no sample data needed
    console.log('Database initialized (empty state)');
    return;
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};
