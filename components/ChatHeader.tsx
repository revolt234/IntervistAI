// ChatHeader.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ChatHeaderProps {
  onToggleHistoryModal: () => void;
  onNewChat: () => void;
  onGoHome: () => void;
  isOnHome: boolean; // 👈 1. Aggiungi la nuova prop qui
  voiceEnabled: boolean;
  onToggleVoice: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleHistoryModal,
  onNewChat,
  onGoHome,
  isOnHome, // 👈 2. Ricevi la prop
  voiceEnabled,
  onToggleVoice,
}) => {
  return (
    <View style={styles.header}>
      {/* Pulsante Cronologia (☰) */}
      <TouchableOpacity onPress={onToggleHistoryModal} style={styles.historyButton}>
        <Text style={styles.historyButtonText}>☰</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onGoHome} style={styles.homeButton}>
        <Text style={styles.homeButtonText}>🏠 Home</Text>
      </TouchableOpacity>

         <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {!isOnHome && (
                <TouchableOpacity onPress={onNewChat} style={styles.newChatButton}>
                  <Text style={styles.newChatButtonText}>+ Nuova Chat</Text>
                </TouchableOpacity>
              )}

        {/* Pulsante Voce */}
        <TouchableOpacity
          onPress={onToggleVoice}
          style={[styles.voiceButton, voiceEnabled && styles.voiceButtonActive]}
        >
          <Text style={styles.voiceButtonText}>{voiceEnabled ? '🔊' : '🔇'}</Text>
        </TouchableOpacity>
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
    fontSize: 24, // Aumentato per migliore visibilità
  },
  // 👇 3. AGGIUNGI QUESTI NUOVI STILI PER IL PULSANTE HOME 👇
  homeButton: {
    padding: 10,
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  // 👆 FINE STILI AGGIUNTI 👆
  newChatButton: {
    padding: 10,
    marginRight: 10, // Aggiunto per distanziare dal pulsante voce
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
  },
});

export default ChatHeader;