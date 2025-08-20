import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ChatHeaderProps {
  onToggleHistoryModal: () => void;
  onNewChat: () => void;
  onGoHome: () => void;
  isOnHome: boolean;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  isLiveMode: boolean; // Assicurati che questa prop sia passata da App.tsx
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleHistoryModal,
  onNewChat,
  onGoHome,
  isOnHome,
  voiceEnabled,
  onToggleVoice,
  isLiveMode,
}) => {
  return (
    <View style={styles.header}>
      {/* Pulsante Cronologia (☰) */}
      <TouchableOpacity onPress={onToggleHistoryModal} style={styles.historyButton}>
        <Text style={styles.historyButtonText}>☰</Text>
      </TouchableOpacity>

      {/* Pulsante Home (visibile solo se non in home) */}
      {!isOnHome ? (
        <TouchableOpacity onPress={onGoHome} style={styles.homeButton}>
          <Text style={styles.homeButtonText}>🏠 Home</Text>
        </TouchableOpacity>
      ) : (
        // Segnaposto invisibile per mantenere l'allineamento
        <View style={styles.homeButton} />
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* --- QUESTA È LA MODIFICA CHIAVE --- */}
        {/* Mostra "Nuova Chat" solo se NON sei in home */}
        {!isOnHome && (
          <TouchableOpacity onPress={onNewChat} style={styles.newChatButton}>
            <Text style={styles.newChatButtonText}>+ Nuova Chat</Text>
          </TouchableOpacity>
        )}

        {/* Pulsante Voce (visibile solo in chat e non in modalità live) */}
        {!isOnHome && !isLiveMode && (
          <TouchableOpacity
            onPress={onToggleVoice}
            style={[styles.voiceButton, voiceEnabled && styles.voiceButtonActive]}
          >
            <Text style={styles.voiceButtonText}>{voiceEnabled ? '🔊' : '🔇'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f8f8f8',
  },
  historyButton: {
    padding: 10,
  },
  historyButtonText: {
    fontSize: 24,
    color: '#000',
  },
  homeButton: {
    padding: 10,
    minWidth: 90,
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  newChatButton: {
    padding: 10,
    marginRight: 10,
  },
  newChatButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
  },
  voiceButton: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  voiceButtonActive: {
    backgroundColor: '#e3f2fd',
  },
  voiceButtonText: {
    fontSize: 16,
    color: '#000',
  },
});

export default ChatHeader;
