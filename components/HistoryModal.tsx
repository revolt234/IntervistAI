// file: components/HistoryModal.tsx
import React from 'react';
import {
  Modal,
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

// Assumo che l'interfaccia Chat sia definita in App.tsx o altrove
interface Chat {
  id: string;
  title: string;
  createdAt: string;
  // ...altre proprietà
}

interface HistoryModalProps {
  visible: boolean;
  onClose: () => void;
  chatHistory: Chat[];
  currentChatId: string | null;
  onLoadChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
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
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
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
                {/* --- QUESTA È LA MODIFICA CHIAVE --- */}
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

// --- STYLESHEET AGGIUNTO E ORGANIZZATO ---
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
    color: '#000', // Colore del titolo del modale
  },
  closeButton: {
    fontSize: 24,
    padding: 5,
    color: '#000', // Colore del pulsante di chiusura
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
    color: '#000', // <-- QUESTA RIGA RISOLVE IL PROBLEMA
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