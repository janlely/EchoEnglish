// Cloudflare Turnstile 配置
export const TurnstileConfig = {
  // 测试用 site key
  // 生产环境请替换为你的实际 site key
  siteKey: __DEV__
    ? '0x4AAAAAACetZ7_UkoFmfQAq'  // 测试环境
    : '0x4AAAAAACetZ7_UkoFmfQAq',  // 生产环境
};

// hCaptcha 配置（备用）
export const HCaptchaConfig = {
  // 测试用 site key
  // 生产环境请替换为你的实际 site key
  siteKey: __DEV__
    ? 'eeeaaae4-2730-40c0-89f0-de482bbe5070'  // 测试环境
    : 'eeeaaae4-2730-40c0-89f0-de482bbe5070',  // 生产环境
};

// 注意：API 配置和 WebSocket 配置已迁移到 constants.ts
// 请使用 import { API_CONFIG, WS_CONFIG } from './constants';
