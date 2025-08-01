

import React, { useState, useEffect, useRef } from 'react';

import {
  SafeAreaView,
  Text,
  Button,
  ScrollView,
  StyleSheet,
  View,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Platform
} from 'react-native';

import { useExportManager } from './hooks/useExportManager';
import { useEvaluationManager } from './hooks/useEvaluationManager';
import HistoryModal from './components/HistoryModal';
import ExportModal from './components/ExportModal';
import ChatInput from './components/ChatInput';
import ChatMessages from './components/ChatMessages';
import ChatHeader from './components/ChatHeader';
import { Picker } from '@react-native-picker/picker';
import { API_KEY } from '@env';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import JsonFileReader from './android/app/src/services/JsonFileReader';
import Tts from 'react-native-tts';
import { useChatManager } from './hooks/useChatManager'; // 👈 nuovo import


interface Chat {
  id: string;
  title: string;
  messages: { role: 'user' | 'bot'; message: string }[];
  createdAt: string;
  evaluationScores: { [fenomeno: string]: number };
}

export default function App() {
  // ✅ Hook personalizzato che gestisce tutta la logica chat
  const {
    chat, setChat,
    input, setInput,
    loading, setLoading,
    evaluating, setEvaluating,
    hasAskedForNameAndBirth, setHasAskedForNameAndBirth,
    chatHistory, setChatHistory,
    currentChatId, setCurrentChatId,
    currentEvaluationScores, setCurrentEvaluationScores,
    askedQuestions, setAskedQuestions,
    initialPromptSent, setInitialPromptSent,
    questions,
    sendMessage,
    startNewChat,
    startInterview,
    saveChat
  } = useChatManager();
  const { exporting, exportChatToFile } = useExportManager();
  const {
    handleEvaluateSingleProblem,
    handleEvaluateProblems,
    extractScoreFromText
  } = useEvaluationManager({
    chat,
    setChat,
    chatHistory,
    currentChatId,
    setEvaluating,
    setCurrentEvaluationScores
  });

  // ✅ Stati locali NON gestiti dal manager
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [problemOptions, setProblemOptions] = useState<any[]>([]);
  const chatScrollViewRef = useRef<ScrollView>(null);








useEffect(() => {
  if (voiceEnabled && chat.length > 0 && chat[chat.length - 1].role === 'bot') {
    Tts.speak(chat[chat.length - 1].message);
  }
}, [chat, voiceEnabled]);


useEffect(() => {
  const loadProblems = async () => {
    try {
      const problems = await JsonFileReader.getProblemDetails();
      setProblemOptions(problems);
    } catch (err) {
      console.error('Errore nel caricamento dei fenomeni:', err);
    }
  };

  if (chat.length > 0 && problemOptions.length === 0) {
    loadProblems();
  }
}, [chat]);

  const toggleVoice = () => {
    if (voiceEnabled) {
      Tts.stop();
    }
    setVoiceEnabled(!voiceEnabled);
  };

 const handleStartNewChat = () => {
   if (voiceEnabled) {
     Tts.stop();
   }
   startNewChat(); // <-- Questo è quello esportato da useChatManager
 };



const handleImportTranscript = async () => {
    // Chiama la funzione che abbiamo corretto in precedenza
    // Questa funzione apre il selettore di file nativo di Android
    const transcript = await JsonFileReader.importTranscriptFromFile();

    // Se l'utente non annulla e il file è valido...
    if (transcript) {
      // 1. Pulisce lo stato della chat precedente e prepara un nuovo ID
      startNewChat();

      // 2. Imposta i messaggi importati come contenuto della chat corrente
      // Assicurati che il formato corrisponda a { role, message }
      setChat(transcript.map(item => ({
        role: item.role === 'medico' ? 'bot' : 'user', // Converte "medico" in "bot"
        message: item.text,
      })));

      // 3. Indica all'app di mostrare la schermata della chat invece di quella iniziale
      setIsFirstLoad(false);

      // 4. Evita che il bot invii il suo messaggio di benvenuto, dato che stiamo caricando una chat esistente
      setInitialPromptSent(true);

      // 5. Comunica all'utente che l'importazione è avvenuta con successo
      Alert.alert('Importazione Riuscita', `Sono state caricate ${transcript.length} battute dal file.`);

      console.log('Trascrizione importata:', transcript);
    }
  };




 const handleStartInterview = async () => {
   setIsFirstLoad(false); // rimane fuori dal hook
   await startInterview(); // chiama la funzione interna del useChatManager
 };


  const loadChat = (chatId: string) => {
    if (voiceEnabled) {
      Tts.stop();
    }

    const selectedChat = chatHistory.find(c => c.id === chatId);
    if (selectedChat) {
      setChat(selectedChat.messages);
      if (selectedChat.evaluationScores) {
        setCurrentEvaluationScores(selectedChat.evaluationScores);
      }
      setCurrentChatId(chatId);
      setHasAskedForNameAndBirth(selectedChat.messages.some(m => m.role === 'bot' && m.message.includes('nome e data di nascita')));
      setShowHistoryModal(false);
      setIsFirstLoad(false);
      setInitialPromptSent(true);

      const questionsAsked = selectedChat.messages
        .filter(m => m.role === 'bot' && m.message.includes('?'))
        .map(m => m.message);
      setAskedQuestions(questionsAsked);
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      const updatedHistory = chatHistory.filter(chat => chat.id !== chatId);
      setChatHistory(updatedHistory);
      await AsyncStorage.setItem('chatHistory', JSON.stringify(updatedHistory));

      if (currentChatId === chatId) {
        startNewChat();
      }
    } catch (error) {
      console.error('Errore durante l\'eliminazione della chat:', error);
      Alert.alert('Errore', 'Impossibile eliminare la chat.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>


      <ChatHeader
        onToggleHistoryModal={() => setShowHistoryModal(true)}
       onNewChat={handleStartNewChat}
        voiceEnabled={voiceEnabled}
        onToggleVoice={toggleVoice}
      />


     <View style={styles.chatContainer}>
       {isFirstLoad && chat.length === 0 ? (
         <View style={styles.startInterviewContainer}>
           <TouchableOpacity
             style={styles.startInterviewButton}
             onPress={handleStartInterview}
           >
             <Text style={styles.startInterviewButtonText}>Inizia Intervista</Text>
           </TouchableOpacity>

           <TouchableOpacity
             style={[styles.startInterviewButton, { marginTop: 15, backgroundColor: '#FFC107' }]}
             onPress={handleImportTranscript} // 👈 questa funzione deve essere definita sopra
           >
             <Text style={styles.startInterviewButtonText}>Valuta Intervista (JSON)</Text>
           </TouchableOpacity>
         </View>
       ) : (
         <>
           <ChatMessages
             chat={chat}
             loading={loading}
             evaluating={evaluating}
             problemOptions={problemOptions}
             onEvaluateSingleProblem={handleEvaluateSingleProblem}
           />
           <ChatInput
             input={input}
             onChangeInput={setInput}
             onSend={sendMessage}
             onImport={handleImportTranscript} // <-- Commenta questa riga
             loading={loading}
             evaluating={evaluating}
           />
           <View style={styles.actionButtons}>
             <View style={[styles.evaluateButton, (loading || evaluating) && styles.disabledInput]}>
               <Button
                 title="Genera Report"
                 onPress={handleEvaluateProblems}
                 disabled={loading || evaluating || chat.length === 0}
                 color="#4CAF50"
               />
             </View>
             <View style={[styles.exportButton, (loading || evaluating || chat.length === 0) && styles.disabledInput]}>
               <Button
                 title={exporting ? "Esportando..." : "Esporta"}
                 onPress={() => setShowExportModal(true)}
                 disabled={loading || evaluating || chat.length === 0 || exporting}
                 color="#FF5722"
               />
             </View>
           </View>
         </>
       )}
     </View>


      <Modal
        animationType="slide"
        transparent={false}
        visible={showHistoryModal}
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cronologia Chat</Text>
            <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {chatHistory.map((item) => (
              <View key={item.id} style={styles.historyItemContainer}>
                <TouchableOpacity
                  style={[
                    styles.historyItem,
                    currentChatId === item.id && styles.selectedHistoryItem
                  ]}
                  onPress={() => loadChat(item.id)}
                >
                  <Text style={styles.historyItemTitle}>{item.title}</Text>
                  <Text style={styles.historyItemDate}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteHistoryItem}
                  onPress={() => deleteChat(item.id)}
                >
                  <Text style={styles.deleteHistoryItemText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

  <ExportModal
    visible={showExportModal}
    onClose={() => setShowExportModal(false)}
    onSave={(fileName) => exportChatToFile(chat, fileName)}
  />
      <Modal transparent={true} visible={evaluating || exporting}>
        <View style={styles.loadingModal}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={styles.loadingText}>
              {exporting ? "Esportazione in corso..." : "Generazione del report in corso..."}
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
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
  chatContainer: {
    flex: 1,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
  },
  message: {
    padding: 10,
    marginVertical: 4,
    borderRadius: 8,
    maxWidth: '80%',
  },
  user: {
    alignSelf: 'flex-end',
    backgroundColor: '#dcf8c6',
  },
  bot: {
    alignSelf: 'flex-start',
    backgroundColor: '#eee',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  disabledInput: {
    opacity: 0.6,
  },
  input: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderRadius: 8,
    marginRight: 8,
    borderColor: '#ccc',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  evaluateButton: {
    flex: 1,
    marginRight: 5,
  },
  exportButton: {
    flex: 1,
    marginLeft: 5,
  },
  loadingModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loadingContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  exportModalContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  fileNameInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    flex: 1,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: 'white',
  },
  startInterviewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startInterviewButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 5,
  },
  startInterviewButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});