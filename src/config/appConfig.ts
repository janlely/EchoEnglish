// Cloudflare Turnstile 配置
export const TurnstileConfig = {
  // 测试用 site key
  // 生产环境请替换为你的实际 site key
  siteKey: __DEV__
    ? '0x4AAAAAACetZ7_UkoFmfQAq'  // 测试环境
    : '你的生产环境-site-key',  // 生产环境
};

// hCaptcha 配置（备用）
export const HCaptchaConfig = {
  // 测试用 site key
  // 生产环境请替换为你的实际 site key
  siteKey: __DEV__
    ? 'eeeaaae4-2730-40c0-89f0-de482bbe5070'  // 测试环境
    : '你的生产环境-site-key',  // 生产环境
};

// API 配置
export const APIConfig = {
  BASE_URL: __DEV__
    ? 'http://192.168.1.4:3000'
    : 'https://your-api-domain.com',
};
