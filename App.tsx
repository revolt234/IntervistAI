import React, { useState, useEffect } from 'react';
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
import { API_KEY } from '@env';
import { GoogleGenerativeAI } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import JsonFileReader from './android/app/src/services/JsonFileReader';
import Tts from 'react-native-tts';
import { captureRef } from 'react-native-view-shot';
import { PDF, PDFPage, PDFText, PDFFont } from 'react-native-pdf';

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

interface Chat {
  id: string;
  title: string;
  messages: { role: 'user' | 'bot'; message: string }[];
  createdAt: string;
}

const ExportModal = ({ visible, onClose, onSave }) => {
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    if (visible) {
      setFileName(`Conversazione_${new Date().toISOString().split('T')[0]}`);
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
            style={styles.fileNameInput}
            value={fileName}
            onChangeText={setFileName}
            placeholder="Inserisci nome file"
            autoFocus
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Annulla</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
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

export default function App() {
  const [input, setInput] = useState('');
  const [chat, setChat] = useState<{ role: 'user' | 'bot'; message: string }[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [hasAskedForNameAndBirth, setHasAskedForNameAndBirth] = useState(false);
  const [chatHistory, setChatHistory] = useState<Chat[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string>(Date.now().toString());
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [askedQuestions, setAskedQuestions] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [initialPromptSent, setInitialPromptSent] = useState(false);
  const chatScrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    Tts.getInitStatus().then(() => {
      Tts.setDefaultLanguage('it-IT');
    });

    const loadQuestions = async () => {
      try {
        const questions = await JsonFileReader.getRandomMedicalQuestions();
        setQuestions(questions);
       // Alert.alert('File salvato con successo', `Il file è stato salvato come: ${questions}`);
      } catch (error) {
        console.error('Errore nel caricamento delle domande:', error);
        Alert.alert('Errore', 'Impossibile caricare le domande mediche.');
      }
    };

    loadQuestions();
  }, []);

  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const savedHistory = await AsyncStorage.getItem('chatHistory');
        if (savedHistory) {
          setChatHistory(JSON.parse(savedHistory));
        }
      } catch (error) {
        console.error('Errore nel caricamento della cronologia:', error);
      }
    };

    loadChatHistory();
  }, []);

  const saveChat = async () => {
    if (chat.length === 0) return;

    // Prendi il primo messaggio utente reale (non quello iniziale nascosto)
    const firstUserMessage = chat.find(msg => msg.role === 'user' && !msg.message.includes('INIZIO_INTERVISTA_NASCOSTO'));
    const chatTitle = firstUserMessage
      ? firstUserMessage.message.substring(0, 30) + (firstUserMessage.message.length > 30 ? '...' : '')
      : 'Nuova conversazione';

    const updatedChat: Chat = {
      id: currentChatId,
      title: chatTitle,
      messages: [...chat],
      createdAt: new Date().toISOString()
    };

    setChatHistory(prev => {
      const existingIndex = prev.findIndex(c => c.id === currentChatId);
      if (existingIndex >= 0) {
        const newHistory = [...prev];
        newHistory[existingIndex] = updatedChat;
        return newHistory;
      } else {
        return [updatedChat, ...prev];
      }
    });
  };

  useEffect(() => {
    saveChat();
  }, [chat, currentChatId]);

  useEffect(() => {
    const saveChatHistory = async () => {
      try {
        await AsyncStorage.setItem('chatHistory', JSON.stringify(chatHistory));
      } catch (error) {
        console.error('Errore nel salvataggio della cronologia:', error);
      }
    };

    if (chatHistory.length > 0) {
      saveChatHistory();
    }
  }, [chatHistory]);

  useEffect(() => {
    if (voiceEnabled && chat.length > 0 && chat[chat.length - 1].role === 'bot') {
      Tts.speak(chat[chat.length - 1].message);
    }
  }, [chat, voiceEnabled]);

  useEffect(() => {
    if (chat.length > 0 && chat[chat.length - 1].role === 'bot') {
      const lastBotMessage = chat[chat.length - 1].message;
      if (!lastBotMessage.includes("Con quale frequenza")&&!lastBotMessage.includes("crea disagio?")) {
        setAskedQuestions(prev => [...prev, lastBotMessage]);
      }
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

  const startNewChat = async () => {
    if (voiceEnabled) {
      Tts.stop();
    }

    if (chat.length > 0) {
      saveChat();
    }

    setChat([]);
    setHasAskedForNameAndBirth(false);
    setCurrentChatId(Date.now().toString());
    setAskedQuestions([]);
    setIsFirstLoad(false);
    setInitialPromptSent(false);
  };

  const startInterview = async () => {
    setIsFirstLoad(false);
    setLoading(true);
    try {
      const prompt = 'Chiedimi gentilmente nome e data di nascita, serve solo che fai questo senza confermare la comprensione di questa richiesta.';
      setHasAskedForNameAndBirth(true);

      // Invia un messaggio nascosto all'utente che non verrà mostrato
      const hiddenUserMessage = { role: 'user', message: 'INIZIO_INTERVISTA_NASCOSTO' };
      setChat([hiddenUserMessage]);

      const chatSession = model.startChat({
        history: [{
          role: 'user',
          parts: [{ text: 'INIZIO_INTERVISTA_NASCOSTO' }],
        }]
      });

      const result = await chatSession.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();

      setChat(prev => [...prev, { role: 'bot', message: text }]);
      setInitialPromptSent(true);
    } catch (err) {
      console.error('Errore durante la richiesta a Gemini:', err);
      setChat([{ role: 'bot', message: 'Errore durante la richiesta.' }]);
    } finally {
      setLoading(false);
    }
  };

  const loadChat = (chatId: string) => {
    if (voiceEnabled) {
      Tts.stop();
    }

    const selectedChat = chatHistory.find(c => c.id === chatId);
    if (selectedChat) {
      setChat(selectedChat.messages);
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

  const handleEvaluateProblems = async () => {
    if (chat.length === 0) {
      Alert.alert('Attenzione', 'Non c\'è alcuna conversazione da valutare');
      return;
    }

    setEvaluating(true);

    try {
      const problemDetails = await JsonFileReader.getProblemDetails();
      const evaluations = [];

      for (const problem of problemDetails) {
        const prompt = `
        - Problematica: ${problem.fenomeno}
        - Descrizione: ${problem.descrizione}
        - Esempio: ${problem.esempio}
        - Punteggio TLDS: ${problem.punteggio}
        **Se il tuo ultimo messaggio è una domanda, non considerare qusta nella valutazione.
        **Valuta la presenza della problematica "${problem.fenomeno}" all'interno delle risposte del paziente, usando il seguente modello:**
        - Modello di output: ${problem.modello_di_output}

        Conversazione completa:
        ${chat.map(msg => `${msg.role}: ${msg.message}`).join('\n')}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        evaluations.push({
          problem: problem.fenomeno,
          evaluation: text || 'Nessuna valutazione disponibile.'
        });
      }

      const formattedEvaluations = evaluations.map(e =>
        `**${e.problem}**\n${e.evaluation}\n\n`
      ).join('---\n');

      setChat(prev => [
        ...prev,
        { role: 'bot', message: formattedEvaluations }
      ]);
    } catch (err) {
      console.error('Errore durante la valutazione:', err);
      Alert.alert('Errore', 'Si è verificato un errore durante la valutazione.');
    } finally {
      setEvaluating(false);
    }
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
         prompt = `RISPOSTA PAZIENTE: ${input}
                         ### TU DEVI SEGUIRE QUESTE REGOLE:
                         Seguono 2 punti (punto 1 e punto 2), devi seguire sempre attentamente queste regole, senza mai tralasciare nulla al caso, tenendo in considerazione che devi dare priorità fondamentale al punto 1, e solo se non si ricade nelle sue casistiche passare al punto 2 (non includere messaggi aggiuntivi come "il paziente..."):
                         punto 1. **Fase di controllo prima di considerare il punto 2:**
                            - il paziente non ti ha fornito nome e data di nascita** Se mancano queste informazioni, **richiedile prima di procedere.**
                            - Se il paziente ti ha chiesto qualcosa, come chiarimenti o altro, **rispondi prima di proseguire**.
                            - Se il paziente esprime dubbi sulla domanda ricevuta, come magari "in che senso", o roba simile, rispiegagli la domanda.
                            - IMPORTANTE - REGOLA OBBLIGATORIA (DA ESEGUIRE SEMPRE, SENZA ECCEZIONI):

                              Ogni volta che il paziente risponde affermativamente a una domanda in cui gli viene chiesto se gli capita qualcosa (es. “Ti capita mai di...”, “Succede che tu...”, “Hai notato che a volte...”), DEVI SEMPRE E SUBITO fare queste DUE DOMANDE DI APPROFONDIMENTO, senza saltarle mai:

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

                         ⚠ **IMPORTANTE:** Se si rientra nei criteri del punto 1 non considerare il punto 2, sono mutuamente esclusivi**.

                         punto 2. **Qui sotto hai l'elenco delle domande da poter fare, segui l'ordine così come impostato, senza prendere iniziative, devi scegliere una sola domanda per volta, se segui le regole che seguono tutto andrà bene (ricorda questi passaggi bisogna farli solo e solo se hai avuto nome e data di nascita dal paziente):**
                            - ${questions}
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowHistoryModal(true)} style={styles.historyButton}>
          <Text style={styles.historyButtonText}>☰</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={startNewChat} style={styles.newChatButton}>
          <Text style={styles.newChatButtonText}>+ Nuova Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleVoice} style={[styles.voiceButton, voiceEnabled && styles.voiceButtonActive]}>
          <Text style={styles.voiceButtonText}>{voiceEnabled ? '🔊' : '🔇'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chatContainer}>
        {isFirstLoad && chat.length === 0 ? (
          <View style={styles.startInterviewContainer}>
            <TouchableOpacity
              style={styles.startInterviewButton}
              onPress={startInterview}
            >
              <Text style={styles.startInterviewButtonText}>Inizia Intervista</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.chatScroll}
              contentContainerStyle={styles.chatContent}
              ref={chatScrollViewRef}
              onContentSizeChange={() => chatScrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {chat
                .filter(msg => msg.message !== 'INIZIO_INTERVISTA_NASCOSTO') // Nascondi il messaggio iniziale
                .map((msg, index) => (
                  <View
                    key={index}
                    style={[styles.message, msg.role === 'user' ? styles.user : styles.bot]}
                  >
                    <Text>{msg.message}</Text>
                  </View>
                ))}
              {(loading || evaluating) && (
                <View style={[styles.message, styles.bot]}>
                  <ActivityIndicator size="small" color="#0000ff" />
                  <Text>{evaluating ? 'Generando report...' : 'Caricando...'}</Text>
                </View>
              )}
            </ScrollView>

            <View style={[styles.inputContainer, (loading || evaluating) && styles.disabledInput]}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Scrivi un messaggio..."
                style={styles.input}
                multiline
                editable={!loading && !evaluating}
              />
              <Button
                title="Invia"
                onPress={handleSend}
                disabled={loading || evaluating || !input.trim()}
              />
            </View>

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