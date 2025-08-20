import React, { useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  StyleSheet, // <-- Importa StyleSheet
} from 'react-native';

interface ChatMessagesProps {
  chat: { role: 'user' | 'bot'; message: string }[];
  loading: boolean;
  evaluating: boolean;
  problemOptions: any[];
   disabled: boolean; // Aggiungi questa prop
  onEvaluateSingleProblem: (problem: any) => void;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  chat,
  loading,
  evaluating,
  problemOptions,
  onEvaluateSingleProblem,
  disabled // <-- AGGIUNGI QUESTA
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const [dropdownVisible, setDropdownVisible] = React.useState(false);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        ref={scrollRef}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {chat
          .filter(msg => msg.message !== 'INIZIO_INTERVISTA_NASCOSTO')
          .map((msg, index) => (
            <View
              key={index}
              style={[
                styles.messageBubble, // Stile base per la bolla
                msg.role === 'user' ? styles.userBubble : styles.botBubble, // Stili specifici
              ]}
            >
              {/* --- QUESTA È LA MODIFICA CHIAVE --- */}
              <Text style={styles.messageText}>{msg.message}</Text>
            </View>
          ))}

        {(loading || evaluating) && (
          <View style={[styles.messageBubble, styles.botBubble]}>
            <ActivityIndicator size="small" color="#000" />
            <Text style={styles.loadingText}>{evaluating ? 'Generando report...' : 'Caricando...'}</Text>
          </View>
        )}
      </ScrollView>

      {/* La parte del modale per la valutazione rimane invariata */}
      {chat.length > 0 && problemOptions.length > 0 && (
        <View style={styles.evaluationContainer}>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setDropdownVisible(true)}
          disabled={disabled} // <-- AGGIUNGI QUESTA RIGA
        >
            <Text style={styles.dropdownButtonText}>📋 Seleziona un fenomeno da valutare</Text>
          </TouchableOpacity>

          <Modal
            visible={dropdownVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setDropdownVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPressOut={() => setDropdownVisible(false)}
            >
              <View style={styles.modalContent}>
                <ScrollView>
                  {problemOptions.map((problem, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.problemOption}
                      onPress={() => {
                        setDropdownVisible(false);
                        onEvaluateSingleProblem(problem);
                      }}
                    >
                      <Text style={styles.problemText}>{problem.fenomeno}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      )}
    </>
  );
};

// --- STYLESHEET AGGIUNTO E ORGANIZZATO ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  messageBubble: {
    padding: 12,
    marginVertical: 4,
    borderRadius: 12,
    maxWidth: '80%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#dcf8c6',
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#eee',
  },
  messageText: {
    fontSize: 16,
    color: '#000', // <-- Colore del testo impostato a nero
  },
  loadingText: {
    color: '#000',
    marginLeft: 8,
  },
  evaluationContainer: {
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 12,
    backgroundColor: '#f5f5f5',
  },
  dropdownButtonText: {
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
  },
  modalContent: {
    marginHorizontal: 20,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 10,
    maxHeight: 300,
  },
  problemOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  problemText: {
    fontSize: 16,
    color: '#000',
  },
});

export default ChatMessages;