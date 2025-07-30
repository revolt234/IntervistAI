import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ChatHeaderProps {
  onToggleHistoryModal: () => void;
  onNewChat: () => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleHistoryModal,
  onNewChat,
  voiceEnabled,
  onToggleVoice,
}) => {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onToggleHistoryModal} style={styles.historyButton}>
        <Text style={styles.historyButtonText}>☰</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onNewChat} style={styles.newChatButton}>
        <Text style={styles.newChatButtonText}>+ Nuova Chat</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onToggleVoice}
        style={[styles.voiceButton, voiceEnabled && styles.voiceButtonActive]}
      >
        <Text style={styles.voiceButtonText}>{voiceEnabled ? '🔊' : '🔇'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f8f8f8',
  },
  historyButton: {
    padding: 10,
  },
  historyButtonText: {
    fontSize: 16,
  },
  newChatButton: {
    padding: 10,
  },
  newChatButtonText: {
    fontSize: 16,
    color: '#2196F3',
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
