// Jest 全局设置
process.env.DATABASE_URL = 'file:./test.db';
process.env.NODE_ENV = 'test';

// 启用 SQLite 外键约束
const { execSync } = require('child_process');
try {
  // 设置 PRAGMA 启用外键
  execSync('sqlite3 test.db "PRAGMA foreign_keys = ON;"', { stdio: 'ignore' });
} catch (e) {
  // 忽略错误
}
