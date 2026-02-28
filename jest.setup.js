/**
 * Jest setup file for global mocks and configurations
 */

// Mock react-native-keyboard-controller
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardStickyView: 'KeyboardStickyView',
  useReanimatedKeyboardAnimation: () => ({
    height: { value: 0 },
  }),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  }),
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
    useFocusEffect: (callback) => {
      callback();
    },
  };
});

// Mock @nozbe/watermelondb/react
jest.mock('@nozbe/watermelondb/react', () => ({
  DatabaseProvider: 'DatabaseProvider',
  useDatabase: () => ({
    collections: {
      get: jest.fn(),
    },
    write: jest.fn((fn) => fn()),
  }),
}));

// Mock @nozbe/watermelondb/hooks
jest.mock('@nozbe/watermelondb/hooks', () => ({
  useDatabase: () => ({
    collections: {
      get: jest.fn(),
    },
    write: jest.fn((fn) => fn()),
  }),
}));

// Mock Q (query builder)
jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn(),
    sortBy: jest.fn(),
  },
}));
