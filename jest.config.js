module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.tsx?$': [
      'babel-jest',
      {
        plugins: [['@babel/plugin-proposal-decorators', { legacy: true }]],
      },
    ],
  },
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock.js',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/server/',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
