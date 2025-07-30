import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

interface Chat {
  id: string;
  title: string;
  createdAt: string;
}

interface HistoryModalProps {
  visible: boolean;
  onClose: () => void;
  chatHistory: Chat[];
  currentChatId: string;
  onLoadChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({
  visible,
  onClose,
  chatHistory,
  currentChatId,
  onLoadChat,
  onDeleteChat,
}) => {
  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Cronologia Chat</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {chatHistory.map((item) => (
            <View key={item.id} style={styles.historyItemContainer}>
              <TouchableOpacity
                style={[
                  styles.historyItem,
                  currentChatId === item.id && styles.selectedHistoryItem,
                ]}
                onPress={() => onLoadChat(item.id)}
              >
                <Text style={styles.historyItemTitle}>{item.title}</Text>
                <Text style={styles.historyItemDate}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteHistoryItem}
                onPress={() => onDeleteChat(item.id)}
              >
                <Text style={styles.deleteHistoryItemText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    padding: 5,
  },
  modalContent: {
    flex: 1,
    padding: 10,
  },
  historyItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  historyItem: {
    flex: 1,
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  selectedHistoryItem: {
    backgroundColor: '#e3f2fd',
  },
  historyItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyItemDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  deleteHistoryItem: {
    padding: 10,
  },
  deleteHistoryItemText: {
    fontSize: 16,
    color: '#F44336',
  },
});

export default HistoryModal;
