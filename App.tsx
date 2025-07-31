import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  Text,
  TextInput,
  Button,
  ScrollView,
  StyleSheet,
  View,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Dimensions,
  PermissionsAndroid,
  Platform
} from 'react-native';
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
import RNFS from 'react-native-fs';
import JsonFileReader from './android/app/src/services/JsonFileReader';
import Tts from 'react-native-tts';
import { captureRef } from 'react-native-view-shot';
import { PDF, PDFPage, PDFText, PDFFont } from 'react-native-pdf';
import { useChatManager } from './hooks/useChatManager'; // 👈 nuovo import

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
  const [exporting, setExporting] = useState(false);
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

  const requestStoragePermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      if (Platform.Version >= 33) {
        return true;
      }

      const writePermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Permesso di archiviazione',
          message: 'L\'app ha bisogno del permesso per salvare i file',
          buttonPositive: 'Accetta',
          buttonNegative: 'Rifiuta',
        }
      );

      const readPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Permesso di lettura',
          message: 'L\'app ha bisogno del permesso per accedere ai file',
          buttonPositive: 'Accetta',
          buttonNegative: 'Rifiuta',
        }
      );

      return (
        writePermission === PermissionsAndroid.RESULTS.GRANTED &&
        readPermission === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      console.warn('Errore richiesta permessi:', err);
      return false;
    }
  };

  const exportChatToPDF = async (fileName) => {
    setShowExportModal(false);
    setExporting(true);

    try {
      if (!fileName.endsWith('.txt')) {
        fileName += '.txt';
      }

      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert('Permesso negato', 'Per salvare il file è necessario concedere i permessi di archiviazione');
        return;
      }

      let pdfContent = 'Conversazione Medico-Paziente\n\n';
      pdfContent += `Data: ${new Date().toLocaleDateString()}\n\n`;

      chat.forEach(msg => {
        const role = msg.role === 'user' ? 'PAZIENTE' : 'MEDICO';
        pdfContent += `${role}:\n${msg.message}\n\n`;
      });

      const downloadsPath = RNFS.DownloadDirectoryPath;
      const filePath = `${downloadsPath}/${fileName}`;

      await RNFS.writeFile(filePath, pdfContent, 'utf8');

      if (Platform.OS === 'android') {
        await RNFS.scanFile(filePath);
      }

      Alert.alert('File salvato con successo', `Il file è stato salvato come: ${fileName}`);
    } catch (error) {
      console.error('Errore creazione file:', error);
      Alert.alert('Errore', 'Salvataggio file fallito');
    } finally {
      setExporting(false);
    }
  };

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

  const splitTextIntoLines = (text: string, maxLength: number): string[] => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + word).length > maxLength) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });

    if (currentLine.trim().length > 0) {
      lines.push(currentLine.trim());
    }

    return lines;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', message: input };
    setChat(prev => {
      // Se è il primo messaggio reale dell'utente e c'è un messaggio nascosto, rimuovilo
      if (!initialPromptSent && prev.length > 0 && prev[0].message === 'INIZIO_INTERVISTA_NASCOSTO') {
        return [...prev.slice(1), userMessage];
      }
      return [...prev, userMessage];
    });

    setLoading(true);

    try {
      const chatHistoryForAI = chat.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.message }],
      }));

      chatHistoryForAI.push({
        role: 'user',
        parts: [{ text: input }],
      });

      let prompt = '';
      if (!hasAskedForNameAndBirth) {
        prompt = 'Chiedimi gentilmente nome e data di nascita, serve solo che fai questo senza confermare la comprensione di questa richiesta.';
        setHasAskedForNameAndBirth(true);
      } else {
          //Alert.alert('File salvato con successo', `Il file è stato salvato come: ${askedQuestions.join('\n\n,')}`);
          //Alert.alert('File salvato con successo', `Il file è stato salvato come: ${questions}`);
         prompt = `RISPOSTA PAZIENTE: ${input}
                         ### TU DEVI SEGUIRE QUESTE REGOLE:
                         Seguono 2 punti (punto 1 e punto 2), devi seguire sempre attentamente queste regole, senza mai tralasciare nulla al caso, tenendo in considerazione che devi dare priorità fondamentale al punto 1, e solo se non si ricade nelle sue casistiche passare al punto 2 (non includere messaggi aggiuntivi come "il paziente..."):
                         punto 1. **Fase di controllo prima di considerare il punto 2:**
                            - il paziente non ti ha fornito nome e data di nascita** Se mancano queste informazioni, **richiedile prima di procedere.**
                            - Se il paziente ti ha chiesto qualcosa, come chiarimenti o altro, **rispondi prima di proseguire**.
                            - Se il paziente esprime dubbi sulla domanda ricevuta, come magari "in che senso", o roba simile, rispiegagli la domanda.
                            - IMPORTANTE - REGOLA OBBLIGATORIA (DA ESEGUIRE SEMPRE, SENZA ECCEZIONI):

                              Ogni volta che il paziente risponde affermativamente a una domanda in cui gli viene chiesto se gli capita una problematica negativa particolare (es. “Ti capita mai di...”, “Succede che tu...”, “Hai notato che a volte...”), DEVI SEMPRE E SUBITO fare queste DUE DOMANDE DI APPROFONDIMENTO, senza saltarle mai:

                              1) Con quale frequenza ti succede?
                              2) Quanto ti dà fastidio o ti crea disagio?

                              ⚠ NON DEVI CONTINUARE CON ALTRE DOMANDE fino a quando non hai posto queste due domande e hai ricevuto risposta.

                              ⚠ ANCHE SE IL PAZIENTE SEMBRA AVERGIÀ DETTO QUALCOSA SU QUESTI ASPETTI, DEVI COMUNQUE CHIEDERE ESPLICITAMENTE ENTRAMBE LE DOMANDE OGNI VOLTA.

                              ----------------------------------------
                              ESEMPIO DI APPLICAZIONE CORRETTA:
                              Domanda: Ti capita mai di sentirti agitato senza motivo?
                              Risposta del paziente: Sì, ogni tanto mi capita.

                              >> Allora DEVI chiedere:
                              - Con quale frequenza ti succede?
                              - Quanto ti dà fastidio o ti crea disagi?
                              (SE LA DOMANDA PRECEDENTE ERA PROPRIO QUESTA NON CHIEDERLA DI NUOVO)

                         ⚠ **IMPORTANTE:** Se si rientra nei criteri del punto 1 non considerare il punto 2, sono mutuamente esclusivi**.

                         punto 2. **Qui sotto hai l'elenco delle domande numerate, senza prendere iniziative, devi scegliere la prima della lista che non hai già fatto, se segui le regole che seguono tutto andrà bene (ricorda questi passaggi bisogna farli solo e solo se hai avuto nome e data di nascita dal paziente):**
                            - ${questions}
                            - Segui esattamente l'ordine numerato, partendo dalla domanda 1 e seguendo l'ordine.
                            - Non mischiare mai più frasi insieme, solo una dell'elenco deve essere presa.
                            - Se necessario, **riformula la domanda** per renderla più chiara o adatta al contesto, per esempio non puoi dire un proverbio senza prima chiedergli di dirti il significato del proverbio.
                            - Dalle domande disponibili per la scelta devi escludere quelle presenti in questo elenco:\n [${askedQuestions.join(',\n\n')}].
                            - Se tutte le domande disponibili sono state fatte ringrazia il Paziente per aver risposto e concludi l'intervista (ESEMPIO:"Grazie per aver risposto, le domande sono finite")`;
                       }

      const chatSession = model.startChat({
        history: chatHistoryForAI,
      });

      const result = await chatSession.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();

      setChat(prev => [...prev, { role: 'bot', message: text }]);
      setInitialPromptSent(true);
    } catch (err) {
      console.error('Errore durante la richiesta a Gemini:', err);
      setChat(prev => [...prev, { role: 'bot', message: 'Errore durante la richiesta.' }]);
    } finally {
      setLoading(false);
      setInput('');
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
              onSend={handleSend}
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
        onSave={exportChatToPDF}
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