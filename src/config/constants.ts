export const API_CONFIG = {
  BASE_URL: __DEV__ 
    ? 'https://echo.janlely.com'  // 开发环境后端地址
    : 'https://echo.janlely.com',   // 生产环境
  TIMEOUT: 10000,
};

export const WS_CONFIG = {
  URL: __DEV__
    ? 'https://echo.janlely.com'  // 开发环境 WebSocket 地址
    : 'https://echo.janlely.com',   // 生产环境
  PATH: '/socket.io',
};
