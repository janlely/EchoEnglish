import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';

interface MessageActionMenuProps {
  visible: boolean;
  messageText: string;
  messageId: string;
  onPress: (action: 'translate' | 'copy') => void;
  onClose: () => void;
}

const MessageActionMenu: React.FC<MessageActionMenuProps> = ({
  visible,
  messageText,
  messageId,
  onPress,
  onClose,
}) => {
  const handleAction = (action: 'translate' | 'copy') => {
    onPress(action);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleAction('translate')}
            >
              <Text style={styles.menuItemText}>🔤 翻译</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleAction('copy')}
            >
              <Text style={styles.menuItemText}>📋 复制</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 150,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
});

export default MessageActionMenu;
