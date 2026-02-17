# Google Sign-In 配置指南

## 1. 安装依赖

```bash
npm install @react-native-google-signin/google-signin
# 或
yarn add @react-native-google-signin/google-signin
```

## 2. iOS 配置

### 2.1 安装 CocoaPods 依赖
```bash
cd ios
pod install
cd ..
```

### 2.2 在 Google 控制台配置
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 Google Sign-In API
4. 创建 OAuth 2.0 客户端 ID
5. 下载 `GoogleService-Info.plist` 文件
6. 将文件添加到 Xcode 项目中（拖放到 ios/EchoEnglishApp 目录下）

### 2.3 配置 URL Types
在 Xcode 中：
1. 选择项目 → Info → URL Types
2. 添加新的 URL Type
3. URL Schemes 设置为 Google Service-Info.plist 中的 `REVERSED_CLIENT_ID`

## 3. Android 配置

### 3.1 获取 SHA-1 指纹
```bash
cd android
./gradlew signingReport
```

### 3.2 在 Google 控制台配置
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建 OAuth 2.0 客户端 ID（Android 类型）
3. 输入包名：`com.echoenglishapp`
4. 输入 SHA-1 指纹
5. 下载 `google-services.json` 文件
6. 将文件添加到 `android/app/` 目录下

### 3.3 更新 android/build.gradle
```gradle
buildscript {
  dependencies {
    // 添加 Google Services 插件
    classpath 'com.google.gms:google-services:4.3.15'
  }
}
```

### 3.4 更新 android/app/build.gradle
```gradle
apply plugin: 'com.google.gms.google-services'

dependencies {
  // 添加 Google Sign-In 依赖
  implementation 'com.google.android.gms:play-services-auth:20.7.0'
}
```

## 4. 代码配置

### 4.1 初始化 Google Sign-In
在 `App.tsx` 中添加：

```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// 在应用启动时初始化
GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com', // Google Cloud Console 中的 Web 客户端 ID
  offlineAccess: true,
  forceCodeForRefreshToken: true,
});
```

### 4.2 更新 LoginScreen
在 `src/screens/LoginScreen.tsx` 中：

```typescript
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

const handleGoogleLogin = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    await loginWithGoogle(userInfo.data.user);
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      // 用户取消登录
    } else if (error.code === statusCodes.IN_PROGRESS) {
      // 登录正在进行中
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      Alert.alert('错误', 'Google Play Services 不可用');
    } else {
      Alert.alert('Google 登录失败', error.message || '请稍后重试');
    }
  }
};
```

## 5. 获取 Web Client ID

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择你的项目
3. 导航到 API 和服务 → 凭据
4. 创建凭据 → OAuth 客户端 ID
5. 选择"Web 应用"
6. 复制客户端 ID，格式类似：`xxxxx.apps.googleusercontent.com`

## 6. 测试

完成配置后，运行应用测试 Google 登录功能：

```bash
# iOS
npm run ios

# Android
npm run android
```

## 注意事项

1. **iOS**: 确保在真机上测试时配置了正确的 Bundle ID
2. **Android**: 确保使用正确的签名密钥获取 SHA-1（调试和发布可能不同）
3. **Web Client ID**: 必须配置，即使用户只使用移动端登录

## 故障排查

### iOS 常见问题
- 确保 `GoogleService-Info.plist` 已正确添加到 Xcode 项目
- 检查 URL Types 配置是否正确
- 清理并重新构建项目

### Android 常见问题
- 确保 `google-services.json` 在 `android/app/` 目录下
- 检查 SHA-1 指纹是否正确
- 清除应用数据后重试
