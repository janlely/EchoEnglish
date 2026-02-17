import React, { useRef } from 'react';
import { Modal, View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface TurnstileProps {
  visible: boolean;
  siteKey: string;
  onVerify: (token: string) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

const Turnstile: React.FC<TurnstileProps> = ({
  visible,
  siteKey,
  onVerify,
  onError,
  onClose,
}) => {
  const webViewRef = useRef<WebView>(null);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .container {
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          text-align: center;
        }
        h2 {
          color: #333;
          margin-bottom: 20px;
          font-size: 18px;
        }
        .cf-turnstile {
          margin: 20px 0;
        }
        .close-btn {
          background: #f0f0f0;
          border: none;
          padding: 10px 30px;
          border-radius: 8px;
          color: #666;
          font-size: 14px;
          cursor: pointer;
          margin-top: 15px;
        }
        .close-btn:active {
          background: #e0e0e0;
        }
        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }
      </style>
    </head>
    <body>
      <div class="cf-turnstile" 
            data-sitekey="${siteKey}" 
            data-callback="onVerify"
            data-error-callback="onError"
            data-expired-callback="onExpired">
      </div>
      
      <script>
        function onVerify(token) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'success',
            token: token
          }));
        }
        
        function onError(error) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            error: error
          }));
        }
        
        function onExpired() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'expired'
          }));
        }
        
        function onClose() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'close'
          }));
        }
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    console.log('handleMessage called');
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'success':
          console.log('Turnstile token:', data.token);
          onVerify(data.token);
          break;
        case 'error':
          console.log('Turnstile error:', data.error);
          onError(data.error || '验证失败');
          break;
        case 'expired':
          console.log('Turnstile expired');
          onError('验证已过期');
          break;
        case 'close':
          console.log('Turnstile closed');
          onClose();
          break;
      }
    } catch (error) {
      console.error('Turnstile message error:', error);
      onError('验证处理失败');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <WebView
            ref={webViewRef}
            source={{ html, baseUrl: 'https://localhost' }}
            onMessage={handleMessage}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color="#007AFF" />
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'transparent',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 300,
  },
  webView: {
    width: '100%',
    height: 300,
    backgroundColor: 'transparent',
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
});

export default Turnstile;
