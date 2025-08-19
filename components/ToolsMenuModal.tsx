// file: components/ToolsMenuModal.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ToolsMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerateReport: () => void;
  onExportCharts: () => void;
  onExportChat: () => void;
  onImportTranscript: () => void;
  isExporting: boolean;
}

const ToolsMenuModal: React.FC<ToolsMenuModalProps> = ({
  visible,
  onClose,
  onGenerateReport,
  onExportCharts,
  onExportChat,
  onImportTranscript,
  isExporting,
}) => {
  // Funzione helper per gestire la chiusura prima dell'azione
  const handlePress = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.toolsModalOverlay}
        activeOpacity={1}
        onPressOut={onClose}
      >
        <View style={styles.toolsMenuContainer}>
          <TouchableOpacity
            style={styles.toolsMenuButton}
            onPress={() => handlePress(onGenerateReport)}
          >
            <Text style={styles.toolsMenuButtonText}>Genera Report</Text>
          </TouchableOpacity>
          <View style={styles.toolsMenuDivider} />
          <TouchableOpacity
            style={styles.toolsMenuButton}
            onPress={() => handlePress(onExportCharts)}
          >
            <Text style={styles.toolsMenuButtonText}>Esporta Grafici</Text>
          </TouchableOpacity>
          <View style={styles.toolsMenuDivider} />
          <TouchableOpacity
            style={styles.toolsMenuButton}
            onPress={() => handlePress(onExportChat)}
          >
            <Text style={styles.toolsMenuButtonText}>
              {isExporting ? "Esportando..." : "Esporta Chat"}
            </Text>
          </TouchableOpacity>
          <View style={styles.toolsMenuDivider} />
          <TouchableOpacity
            style={styles.toolsMenuButton}
            onPress={() => handlePress(onImportTranscript)}
          >
            <Text style={styles.toolsMenuButtonText}>Importa Trascrizioni</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// Copia gli stili relativi da App.tsx qui
const styles = StyleSheet.create({
  toolsModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  toolsMenuContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  toolsMenuButton: {
    padding: 15,
    alignItems: 'center',
  },
  toolsMenuButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
  },
  toolsMenuDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
  },
});

export default ToolsMenuModal;