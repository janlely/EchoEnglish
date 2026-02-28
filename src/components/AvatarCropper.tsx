import React, { useState } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CROP_SIZE = SCREEN_WIDTH * 0.8; // 80% of screen width

interface AvatarCropperProps {
  visible: boolean;
  onClose: () => void;
  onAvatarCropped: (uri: string) => void;
}

const AvatarCropper: React.FC<AvatarCropperProps> = ({
  visible,
  onClose,
  onAvatarCropped,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // Pick and crop image from gallery
  const pickAndCropImage = async () => {
    try {
      setIsProcessing(true);
      
      // Use react-native-image-crop-picker which has built-in cropping
      const image = await ImagePicker.openPicker({
        width: 400,
        height: 400,
        cropping: true,
        compressImageQuality: 0.8,
        includeBase64: false,
      });

      if (image.path) {
        // Notify parent component with cropped image path
        onAvatarCropped(`file://${image.path}`);
        
        // Close modal
        onClose();
      }
    } catch (error: any) {
      if (error.message?.includes('User cancelled') || error.code === 'E_PICKER_CANCELLED') {
        // User cancelled, just close modal
        onClose();
      } else {
        console.error('[AvatarCropper] Pick error:', error);
        Alert.alert('错误', error.message || '选择图片失败');
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Pick and crop image from camera
  const takeAndCropImage = async () => {
    try {
      setIsProcessing(true);
      
      // Use react-native-image-crop-picker which has built-in cropping
      const image = await ImagePicker.openCamera({
        width: 400,
        height: 400,
        cropping: true,
        compressImageQuality: 0.8,
        includeBase64: false,
      });

      if (image.path) {
        // Notify parent component with cropped image path
        onAvatarCropped(`file://${image.path}`);
        
        // Close modal
        onClose();
      }
    } catch (error: any) {
      if (error.message?.includes('User cancelled') || error.code === 'E_PICKER_CANCELLED') {
        // User cancelled, just close modal
        onClose();
      } else {
        console.error('[AvatarCropper] Camera error:', error);
        Alert.alert('错误', error.message || '拍照失败');
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} disabled={isProcessing}>
              <Text style={[styles.buttonText, isProcessing && styles.buttonTextDisabled]}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.title}>更换头像</Text>
            <View style={styles.spacer} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            {isProcessing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>处理中...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity style={styles.optionButton} onPress={pickAndCropImage}>
                  <Text style={styles.optionButtonText}>📷 从相册选择</Text>
                  <Text style={styles.optionHint}>支持裁剪和缩放</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionButton} onPress={takeAndCropImage}>
                  <Text style={styles.optionButtonText}>📸 拍照</Text>
                  <Text style={styles.optionHint}>拍照后裁剪</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Text style={styles.instructionsTitle}>使用说明：</Text>
            <Text style={styles.instructions}>1. 选择照片后，可以拖动图片调整位置</Text>
            <Text style={styles.instructions}>2. 双指缩放可以调整图片大小</Text>
            <Text style={styles.instructions}>3. 确认后自动压缩到 100x100</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  buttonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: '#999',
  },
  spacer: {
    width: 50,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  optionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  optionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionHint: {
    color: '#E3F2FD',
    fontSize: 13,
  },
  instructionsContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 15,
    width: '100%',
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  instructions: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
});

export default AvatarCropper;
