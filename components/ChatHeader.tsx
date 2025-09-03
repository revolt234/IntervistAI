import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ChatHeaderProps {
  onToggleHistoryModal: () => void;
  onGoHome: () => void;
  isOnHome: boolean;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  isLiveMode: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleHistoryModal,
  onGoHome,
  isOnHome,
  voiceEnabled,
  onToggleVoice,
  isLiveMode,
}) => {
  return (
    <View style={styles.header}>
      {/* Contenitore Sinistro */}
      <View style={styles.leftContainer}>
        <TouchableOpacity onPress={onToggleHistoryModal} style={styles.historyButton}>
          <Text style={styles.historyButtonText}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Contenitore Centrale */}
      <View style={styles.centerContainer}>
        {!isOnHome ? (
          <TouchableOpacity onPress={onGoHome} style={styles.homeButton}>
            <Text style={styles.homeButtonText}>🏠 Home</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.homeButton}>
            <Text style={styles.headerTitle}>IntervistAI</Text>
          </View>
        )}
      </View>

      {/* Contenitore Destro */}
      <View style={styles.rightContainer}>
        {/* Usiamo un operatore ternario per decidere cosa mostrare */}
        {!isOnHome && !isLiveMode ? (
          // CASO 1: Mostra il pulsante della voce
          <TouchableOpacity
            onPress={onToggleVoice}
            style={[styles.voiceButton, voiceEnabled && styles.voiceButtonActive]}
          >
            <Text style={styles.voiceButtonText}>{voiceEnabled ? '🔊' : '🔇'}</Text>
          </TouchableOpacity>
        ) : (
          // CASO 2: In tutti gli altri casi, mostra un segnaposto invisibile
          // per mantenere la simmetria. Usiamo lo stile del pulsante per coerenza dimensionale.
          <View style={[styles.voiceButton, { backgroundColor: 'transparent' }]} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f8f8f8',
  },
  leftContainer: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerContainer: {
    // Questo contenitore si adatta al suo contenuto
  },
  rightContainer: {
    flex: 1,
    alignItems: 'flex-end',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  voiceButton: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44, // Garantisce una dimensione minima touchable
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