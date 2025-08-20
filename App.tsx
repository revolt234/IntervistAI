
//App.tsx
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
} from 'react-native';
import LiveIndicator from './components/LiveIndicator';
import { useUIManager } from './hooks/useUIManager'; // <-- AGGIUNGI
import ToolsMenuModal from './components/ToolsMenuModal'; // <-- AGGIUNGI
import ChartsReportExport from './components/ChartsReportExport'; // default import (senza graffe)
import { useExportManager } from './hooks/useExportManager';
import { useEvaluationManager } from './hooks/useEvaluationManager';
import HistoryModal from './components/HistoryModal';
import ExportModal from './components/ExportModal';
import ChatInput from './components/ChatInput';
import ChatMessages from './components/ChatMessages';
import ChatHeader from './components/ChatHeader';
import { useVoiceRecognition } from './hooks/useVoiceRecognition';
import { API_KEY } from '@env';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import JsonFileReader from './android/app/src/services/JsonFileReader';
import Tts from 'react-native-tts';
import { useChatManager } from './hooks/useChatManager'; // 👈 nuovo import


interface Chat {
  id: string;
  title: string;
   messages: {
     role: 'user' | 'bot';
     message: string;
     start: number;
     end: number;
   }[];
  createdAt: string;
  evaluationScores: { [fenomeno: string]: number };
  // 👇 nuovo
  evaluationLog?: {
    [fenomeno: string]: Array<{ score: number; timestamp: number }>;
  };
  avgTimeResponse?: number;
  avgResponseLength?: number;
  counterInterruption?: number;
   avgSpeechRate?: number; // <-- AGGIUNGI
    maxSpeechRate?: number; // <-- AGGIUNGI
}

export default function App() {
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
     sendVoiceMessage,    // <-- AGGIUNGI QUESTA RIGA
    startNewChat,
    startInterview,
    saveChat
  } = useChatManager();

  const { exporting, exportChatToFile } = useExportManager();
  const voiceManager = useVoiceRecognition(); // <-- AGGIUNGI QUESTA RIGA
  // ✅ 1. DICHIARA LO STATO PER LE METRICHE TEMPORANEE
  const [tempMetrics, setTempMetrics] = useState(null);

  // ✅ 2. PASSA LE METRICHE CORRETTE A useEvaluationManager
  const chatObj = chatHistory.find(c => c.id === currentChatId);

  const metricsForEvaluation = tempMetrics ?? {
    avgTimeResponse: chatObj?.avgTimeResponse,
    avgResponseLength: chatObj?.avgResponseLength,
    counterInterruption: chatObj?.counterInterruption,
    avgSpeechRate: chatObj?.avgSpeechRate, // <-- AGGIUNGI
      maxSpeechRate: chatObj?.maxSpeechRate, // <-- AGGIUNGI
  };


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
   setCurrentEvaluationScores,
   avgTimeResponse: metricsForEvaluation?.avgTimeResponse,
   avgResponseLength: metricsForEvaluation?.avgResponseLength,
   counterInterruption: metricsForEvaluation?.counterInterruption,
   avgSpeechRate: metricsForEvaluation?.avgSpeechRate, // <-- AGGIUNGI
      maxSpeechRate: metricsForEvaluation?.maxSpeechRate, // <-- AGGIUNGI
      setChatHistory,
 });

  // Stati locali NON gestiti dal manager

const { uiState, uiActions } = useUIManager();
  const [voiceEnabled, setVoiceEnabled] = useState(false);
const [isLiveMode, setIsLiveMode] = useState(false); // <-- AGGIUNGI SE MANCA
const [isListeningPaused, setIsListeningPaused] = useState(false);
const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [problemOptions, setProblemOptions] = useState<any[]>([]);

const deactivateLiveMode = () => {
  if (isLiveMode) {
    voiceManager.stopListening();
    setIsLiveMode(false);
  }
};
  const chatScrollViewRef = useRef<ScrollView>(null);



useEffect(() => {
  // Funzioni che aggiornano il nostro stato
  const onStart = () => setIsBotSpeaking(true);
  const onFinish = () => setIsBotSpeaking(false);
  const onCancel = () => setIsBotSpeaking(false);

  // Colleghiamo le funzioni agli eventi della libreria TTS
  Tts.addEventListener('tts-start', onStart);
  Tts.addEventListener('tts-finish', onFinish);
  Tts.addEventListener('tts-cancel', onCancel);

}, []); // L'array vuoto [] assicura che questo venga eseguito solo una volta all'avvio // L'array vuoto [] assicura che questo venga eseguito solo una volta all'avvio


useEffect(() => {
  // Se siamo in modalità live, il bot NON sta parlando, l'ascolto NON è in pausa e il microfono NON è già attivo...
  if (isLiveMode && !isBotSpeaking && !isListeningPaused && !voiceManager.isListening) {
    // ...allora è il turno dell'utente: avvia l'ascolto.
    voiceManager.startListening();
  }
}, [isBotSpeaking, isLiveMode, isListeningPaused]); // Si attiva quando il bot smette di parlare o quando l'utente riprende l'ascolto
useEffect(() => {
  // Invia il messaggio solo se NON siamo in pausa
  if (isLiveMode && !isListeningPaused && voiceManager.hasFinishedSpeaking && voiceManager.recognizedText) {
    sendVoiceMessage(voiceManager.recognizedText, voiceManager.speechStartTime, voiceManager.speechEndTime);
    voiceManager.resetFinishedSpeaking();
  }
}, [voiceManager.hasFinishedSpeaking, isListeningPaused]);

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
// ...dopo l'ultimo useEffect esistente

// Inserisci questo blocco di codice in App.tsx insieme agli altri useEffect

useEffect(() => {
  const lastMessage = chat[chat.length - 1];

  // Controlliamo solo se l'ultimo messaggio è del bot
  if (lastMessage?.role === 'bot') {
    // Se la voce è abilitata o siamo in live mode, il bot deve parlare
    if (voiceEnabled || isLiveMode) {
      // Come sicurezza, fermiamo qualsiasi parlato precedente
      Tts.stop();
      // Se per caso il microfono fosse attivo, lo fermiamo
      if (voiceManager.isListening) {
        voiceManager.stopListening();
      }
      // Ora facciamo parlare il bot con il nuovo messaggio
      Tts.speak(lastMessage.message);
    }
  }
}, [chat]); // <-- La dipendenza è solo 'chat', quindi si attiva UNA SOLA VOLTA per ogni nuovo messaggio
// useEffect N.2: GESTISCE IL MICROFONO DELL'UTENTE
useEffect(() => {
  // Se siamo in Modalità Live, il bot HA FINITO di parlare, l'ascolto NON è in pausa...
  if (isLiveMode && !isBotSpeaking && !isListeningPaused) {
    // ...allora è il turno dell'utente: avvia l'ascolto.
    voiceManager.startListening();
  }
}, [isBotSpeaking, isListeningPaused, isLiveMode]); // Si attiva quando il bot smette di parlare
  const toggleVoice = () => {
    if (voiceEnabled) {
      Tts.stop();
    }
    setVoiceEnabled(!voiceEnabled);
  };
const handleStartNewChat = async () => {
  if (voiceEnabled) {
    Tts.stop();
  }
  await handleStartInterviewAndChat();
};
const handleStartLiveMode = () => {
  setIsLiveMode(true);
  handleStartInterviewAndChat(true); // Avvia l'intervista in modalità live
};
const toggleLiveListening = () => {
  // Se l'ascolto è in pausa, lo riattiviamo
  if (isListeningPaused) {
    voiceManager.startListening();
    setIsListeningPaused(false);
  } else { // Altrimenti, lo mettiamo in pausa
    voiceManager.stopListening();
    setIsListeningPaused(true);
  }
};

const handleImportTranscript = async () => {
  const result = await JsonFileReader.importTranscriptFromFile();
  if (result) {
    const { transcript, ...metrics } = result;

    // Mappiamo i messaggi includendo i timestamp dal file
    let mappedMessages = transcript.map(item => ({
      role: item.role === 'medico' ? 'bot' : 'user',
      message: item.text,
      start: item.start,
      end: item.end,
    }));

    // Aggiungiamo un messaggio fittizio con timestamp a zero se necessario
    if (chat.length === 0 && mappedMessages.length > 0 && mappedMessages[0].role !== 'user') {
      const firstUserMsg = mappedMessages.find(m => m.role === 'user');
      const messageText = firstUserMsg ? `Chat di ${firstUserMsg.message}` : '[Inizio conversazione importata]';
      mappedMessages.unshift({
        role: 'user',
        message: messageText,
        start: 0,
        end: 0
      });
    }

    // Aggiungiamo i messaggi importati in coda a quelli esistenti
    setChat(prev => [...prev, ...mappedMessages]);

    setTempMetrics(metrics);
    uiActions.setFirstLoad(false);
    setInitialPromptSent(true);
    const importedQuestions = mappedMessages
      .filter(m => m.role === 'bot' && m.message.includes('?'))
      .map(m => m.message);
    setAskedQuestions(prev => [...prev, ...importedQuestions]);

    Alert.alert(
      'Importazione Riuscita',
      `Aggiunte ${transcript.length} battute alla conversazione.\n` +
      `Tempo medio risposta: ${metrics.avgTimeResponse.toFixed(2)}s\n` +
      `Velocità media: ${metrics.avgSpeechRate.toFixed(2)} parole/s`
    );
  }
};
const handleStartInterviewAndChat = async (liveMode = false) => {
  setIsLiveMode(liveMode);
  if (liveMode) {
    setIsListeningPaused(false);
  }
  uiActions.setFirstLoad(false);
  await startInterview();
  // Il microfono verrà avviato dall'useEffect che abbiamo aggiunto prima
};
const handleSelectProblemToEvaluate = (problem: any) => {
  deactivateLiveMode();
  handleEvaluateSingleProblem(problem);
};
const handleEndLiveMode = () => {
  voiceManager.stopListening(); // Ferma il microfono
};
const handleOpenToolsMenu = () => {
  deactivateLiveMode();
  uiActions.openToolsMenu();
};
  const loadChat = (chatId: string) => {
      deactivateLiveMode();
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
     //...dentro loadChat
     uiActions.closeHistoryModal();
     uiActions.setFirstLoad(false);
     setTempMetrics(null); // Aggiungi questo per resettare le metriche quando carichi una chat
      setInitialPromptSent(true);

      const questionsAsked = selectedChat.messages
        .filter(m => m.role === 'bot' && m.message.includes('?'))
        .map(m => m.message);
      setAskedQuestions(questionsAsked);
    }
  };
// In App.tsx, all'interno del componente App()
const handleGoHome = () => {
     deactivateLiveMode();
  if (voiceEnabled) {
    Tts.stop();
  }
  startNewChat();
  uiActions.setFirstLoad(true);
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
            onToggleHistoryModal={uiActions.openHistoryModal}
            onNewChat={handleStartNewChat}
            onGoHome={handleGoHome}
            isOnHome={uiState.isFirstLoad}
            voiceEnabled={voiceEnabled}
            onToggleVoice={toggleVoice}
            isLiveMode={isLiveMode}
          />

          <View style={styles.chatContainer}>
            {uiState.isFirstLoad && chat.length === 0 ? (
              // --- SCHERMATA INIZIALE ---
              <View style={styles.startInterviewContainer}>
                <TouchableOpacity
                  style={styles.startInterviewButton}
                  onPress={() => handleStartInterviewAndChat(false)}
                >
                  <Text style={styles.startInterviewButtonText}>Inizia Intervista</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.startInterviewButton, { marginTop: 15, backgroundColor: '#FFC107' }]}
                  onPress={handleImportTranscript}
                >
                  <Text style={styles.startInterviewButtonText}>Valuta Intervista (JSON)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.startInterviewButton, { marginTop: 15, backgroundColor: '#4CAF50' }]}
                  onPress={() => handleStartInterviewAndChat(true)}
                >
                  <Text style={styles.startInterviewButtonText}>🎙️ Modalità Live (Voce)</Text>
                </TouchableOpacity>
              </View>
            ) : (

              <>
                <ChatMessages
                  chat={chat}
                  loading={loading}
                  evaluating={evaluating}
                  problemOptions={problemOptions}
                  onEvaluateSingleProblem={handleSelectProblemToEvaluate}
                  disabled={isLiveMode && !isListeningPaused}
                />

                {isLiveMode && (
                  <LiveIndicator
                    isListening={!isListeningPaused && voiceManager.isListening}
                    recognizedText={voiceManager.recognizedText}
                  />
                )}

                {/* --- BARRA INFERIORE CON LOGICA CORRETTA --- */}
              <View style={styles.bottomBar}>
                {isLiveMode && !isListeningPaused ? (
                  // CASO 1: Modalità Live ATTIVA (solo pulsante di pausa)
                  <TouchableOpacity
                    style={[styles.startInterviewButton, { backgroundColor: '#f44336' }]}
                    onPress={toggleLiveListening} // Mette in pausa
                  >
                    <Text style={styles.startInterviewButtonText}>⏸️ Ferma Ascolto</Text>
                  </TouchableOpacity>
                ) : (
                    // --- UI PER MODALITÀ TESTO ---
                    <>
                         <ChatInput
                           input={input}
                           onChangeInput={setInput}
                           onSend={sendMessage}
                           loading={loading}
                           evaluating={evaluating}
                         />
                         <View style={styles.actionButtons}>
                           {/* Mostra il pulsante "Riprendi" solo se siamo in live mode e in pausa */}
                           {isLiveMode && isListeningPaused && (
                             <View style={styles.toolsButtonContainer}>
                               <Button
                                 title="▶️ Riprendi"
                                 onPress={toggleLiveListening} // Riprende l'ascolto
                                 color="#4CAF50"
                               />
                             </View>
                           )}
                           <View style={styles.toolsButtonContainer}>
                             <Button
                               title="🔧 Strumenti"
                               onPress={handleOpenToolsMenu}
                               disabled={loading || evaluating || chat.length === 0}
                               color="#673AB7"
                             />
                           </View>
                         </View>
                       </>
                     )}
                   </View>
              </>
            )}
          </View>

          {/* --- MODALI --- */}
          <ToolsMenuModal
            visible={uiState.isToolsMenuVisible}
            onClose={uiActions.closeToolsMenu}
            onGenerateReport={handleEvaluateProblems}
            onExportCharts={uiActions.openChartsModal}
            onExportChat={uiActions.openExportModal}
            onImportTranscript={handleImportTranscript}
            onStartLiveMode={handleStartLiveMode}
            isExporting={exporting}
          />

          <HistoryModal
            visible={uiState.showHistoryModal}
            onClose={uiActions.closeHistoryModal}
            chatHistory={chatHistory}
            currentChatId={currentChatId}
            onLoadChat={loadChat}
            onDeleteChat={deleteChat}
          />

          <ExportModal
            visible={uiState.showExportModal}
            onClose={uiActions.closeExportModal}
            onSave={(fileName) => exportChatToFile(chat, fileName)}
          />

          <Modal
            animationType="slide"
            transparent={false}
            visible={uiState.showChartsModal}
            onRequestClose={uiActions.closeChartsModal}
          >
            <SafeAreaView style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Report Grafici</Text>
                <TouchableOpacity onPress={uiActions.closeChartsModal}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalContent}>
                <ChartsReportExport
                  problems={problemOptions}
                  evaluationLog={chatHistory.find(c => c.id === currentChatId)?.evaluationLog}
                  onSaved={uiActions.closeChartsModal}
                />
              </ScrollView>
            </SafeAreaView>
          </Modal>

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