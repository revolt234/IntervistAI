
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
    startNewChat,
    startInterview,
    saveChat
  } = useChatManager();

  const { exporting, exportChatToFile } = useExportManager();

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
const handleStartNewChat = async () => {
  if (voiceEnabled) {
    Tts.stop();
  }
  await handleStartInterviewAndChat();
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
const handleStartInterviewAndChat = async () => {
  uiActions.setFirstLoad(false);
  await startInterview();
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
        />

        <View style={styles.chatContainer}>
          {uiState.isFirstLoad && chat.length === 0 ? (
            <View style={styles.startInterviewContainer}>
              <TouchableOpacity
                style={styles.startInterviewButton}
                onPress={handleStartInterviewAndChat}
              >
                <Text style={styles.startInterviewButtonText}>Inizia Intervista</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.startInterviewButton, { marginTop: 15, backgroundColor: '#FFC107' }]}
                onPress={handleImportTranscript}
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
                loading={loading}
                evaluating={evaluating}
              />
              <View style={styles.actionButtons}>
                <View style={styles.toolsButtonContainer}>
                  <Button
                    title="🔧 Strumenti"
                    onPress={uiActions.openToolsMenu}
                    disabled={loading || evaluating || chat.length === 0}
                    color="#673AB7"
                  />
                </View>
              </View>
            </>
          )}
        </View>

        <ToolsMenuModal
          visible={uiState.isToolsMenuVisible}
          onClose={uiActions.closeToolsMenu}
          onGenerateReport={handleEvaluateProblems}
          onExportCharts={uiActions.openChartsModal}
          onExportChat={uiActions.openExportModal}
          onImportTranscript={handleImportTranscript}
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

        {/* Modale per i grafici */}
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

        {/* Modale di caricamento */}
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