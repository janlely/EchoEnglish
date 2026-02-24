export const API_CONFIG = {
  BASE_URL: __DEV__ 
    ? 'http://10.244.206.215:3000'  // 开发环境后端地址
    : 'http://localhost:3000',   // 生产环境
  TIMEOUT: 10000,
};

export const WS_CONFIG = {
  URL: __DEV__
    ? 'http://10.244.206.215:3000'  // 开发环境 WebSocket 地址
    : 'http://localhost:3000',   // 生产环境
  PATH: '/socket.io',
};
