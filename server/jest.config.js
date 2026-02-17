module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  verbose: true,
  // 设置测试数据库环境变量
  setupFiles: ['./tests/jest-setup.ts'],
  // 全局 setup - 运行迁移
  globalSetup: './tests/jest-global-setup.ts',
  // 全局 teardown - 清理数据库
  globalTeardown: './tests/jest-global-teardown.ts',
};
