import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (fileName: string) => void;
}

const ExportModal: React.FC<ExportModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    if (visible) {
      setFileName(`Conversazione_${new Date().toISOString().split('T')[0]}.json`);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Salva conversazione</Text>

          <TextInput
            style={styles.input}
            value={fileName}
            onChangeText={setFileName}
            placeholder="Inserisci nome file"
            placeholderTextColor="#999" // Aggiunto per migliorare la visibilità del placeholder
            autoFocus
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancel]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Annulla</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.save]}
              onPress={() => onSave(fileName)}
              disabled={!fileName.trim()}
            >
              <Text style={styles.buttonText}>Salva</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#000', // Aggiunto per coerenza
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    color: '#000', // <-- QUESTA È LA MODIFICA CHIAVE
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  cancel: {
    backgroundColor: '#888',
    marginRight: 10,
  },
  save: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default ExportModal;