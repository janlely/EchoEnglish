// Jest 全局设置
process.env.DATABASE_URL = 'file:./test.db';
process.env.NODE_ENV = 'test';

// 在测试前运行迁移
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const globalSetup = async () => {
  // 删除旧的测试数据库
  const testDbPath = path.join(__dirname, '../test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // 运行 Prisma 迁移
  try {
    execSync('npx prisma migrate dev --name init --skip-seed', {
      env: {
        ...process.env,
        DATABASE_URL: 'file:./test.db',
      },
      stdio: 'ignore',
      cwd: path.join(__dirname, '..'),
    });
    console.log('Database migration completed successfully');
  } catch (error) {
    console.error('Database migration failed:', error);
    throw error;
  }
};

export default globalSetup;
