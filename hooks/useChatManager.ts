// hooks/useChatManager.ts

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Tts from 'react-native-tts';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { API_KEY } from '@env';
import JsonFileReader from '../android/app/src/services/JsonFileReader';

// Inizializzazione del modello AI
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Uso il modello più recente per performance migliori

// Definizione delle interfacce per la tipizzazione
export interface Message {
  role: 'user' | 'bot';
  message: string;
  start: number;
  end: number;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  evaluationScores: { [fenomeno: string]: number };
  evaluationLog?: { [fenomeno: string]: Array<{ score: number; timestamp: number }> };
}

export const useChatManager = () => {
  // --- STATI DEL COMPONENTE ---
  const [chat, setChat] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [hasAskedForNameAndBirth, setHasAskedForNameAndBirth] = useState(false);
  const [chatHistory, setChatHistory] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string>(Date.now().toString());
  const [currentEvaluationScores, setCurrentEvaluationScores] = useState<{ [key: string]: number }>({});
  const [askedQuestions, setAskedQuestions] = useState<string[]>([]);
  const [initialPromptSent, setInitialPromptSent] = useState(false);

  // --- HOOKS useEffect PER GESTIRE EFFETTI COLLATERALI ---
  useEffect(() => {
    // Inizializzazione al primo avvio
    Tts.getInitStatus().then(() => Tts.setDefaultLanguage('it-IT'));
    JsonFileReader.getRandomMedicalQuestions().then(setQuestions).catch(console.error);
    AsyncStorage.getItem('chatHistory').then(data => {
      if (data) setChatHistory(JSON.parse(data));
    });
  }, []);

  useEffect(() => {
    // Traccia le domande già fatte dal bot
    if (chat.length > 0 && chat[chat.length - 1].role === 'bot') {
      const text = chat[chat.length - 1].message;
      if (!text.includes("Con quale frequenza") && !text.includes("crea disagio?")) {
        setAskedQuestions(prev => [...prev, text]);
      }
    }
  }, [chat]);

  useEffect(() => {
    // Salva la chat corrente ogni volta che viene aggiornata
    if (chat.length > 0) saveChat();
  }, [chat]);

  useEffect(() => {
    // Salva la cronologia completa delle chat quando cambia
    if (chatHistory.length > 0) {
      AsyncStorage.setItem('chatHistory', JSON.stringify(chatHistory)).catch(console.error);
    }
  }, [chatHistory]);


  // --- FUNZIONI PRINCIPALI ---

  const saveChat = () => {
    if (chat.length === 0) return;
    const firstUserMsg = chat.find(msg => msg.role === 'user' && !msg.message.includes('INIZIO_INTERVISTA_NASCOSTO'));
    const title = firstUserMsg ? firstUserMsg.message.slice(0, 30) + (firstUserMsg.message.length > 30 ? '...' : '') : 'Nuova conversazione';
    setChatHistory(prev => {
      const existingIdx = prev.findIndex(c => c.id === currentChatId);
      const existing = existingIdx >= 0 ? prev[existingIdx] : undefined;
      const updatedChat: Chat = {
        id: currentChatId,
        title,
        messages: [...chat],
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        evaluationScores: currentEvaluationScores,
        evaluationLog: existing?.evaluationLog ?? {},
      };
      if (existingIdx >= 0) {
        const newHistory = [...prev];
        newHistory[existingIdx] = { ...existing, ...updatedChat };
        return newHistory;
      } else {
        return [updatedChat, ...prev];
      }
    });
  };

  const startNewChat = async () => {
    Tts.stop();
    if (chat.length > 0) saveChat();
    setChat([]);
    setInput('');
    setHasAskedForNameAndBirth(false);
    setCurrentChatId(Date.now().toString());
    setInitialPromptSent(false);
    setCurrentEvaluationScores({});
    setAskedQuestions([]);
    try {
      const newQuestions = await JsonFileReader.getRandomMedicalQuestions();
      setQuestions(newQuestions);
    } catch (error) {
      console.error('Errore durante il caricamento delle nuove domande:', error);
    }
  };

  const updateLastBotMessageTimestamp = useCallback((type: 'start' | 'end') => {
    setChat(prevChat => {
      const newChat = [...prevChat];
      const lastBotMsgIndex = newChat.map(m => m.role).lastIndexOf('bot');

      if (lastBotMsgIndex !== -1) {
        const updatedMessage = { ...newChat[lastBotMsgIndex] };
        if (type === 'start') {
          updatedMessage.start = Date.now() / 1000;
        } else {
          updatedMessage.end = Date.now() / 1000;
        }
        newChat[lastBotMsgIndex] = updatedMessage;
        return newChat;
      }
      return prevChat;
    });
  }, []);

  // Funzione centralizzata per ottenere la risposta del bot
  const getBotResponse = async (currentUserMessage: Message, currentChat: Message[], isVoiceEnabled: boolean) => {
    setLoading(true);
    try {
      const chatHistoryForAI = currentChat.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.message }],
      }));

      chatHistoryForAI.push({
        role: 'user',
        parts: [{ text: currentUserMessage.message }],
      });

      let prompt = '';
      if (!hasAskedForNameAndBirth) {
        prompt = 'Chiedimi gentilmente nome e data di nascita, serve solo che fai questo senza confermare la comprensione di questa richiesta.';
        setHasAskedForNameAndBirth(true);
      } else {
        prompt = `RISPOSTA PAZIENTE: ${currentUserMessage.message}
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

       const chatSession = model.startChat({ history: chatHistoryForAI });
              const result = await chatSession.sendMessage(prompt);
              const text = result.response.text();

              const botMessage: Message = {
                role: 'bot',
                message: text,
                start: 0, // Segnaposto, aggiornato da updateLastBotMessageTimestamp
                end: 0,   // Segnaposto, aggiornato da updateLastBotMessageTimestamp
              };
              setChat(prev => [...prev, botMessage]);
              setInitialPromptSent(true);

              // ✅ CONTROLLO VOCALE: Parla solo se la voce è abilitata
              if (isVoiceEnabled) {
                  Tts.speak(text);
              }
            } catch (err) {
              console.error('Errore durante la richiesta a Gemini:', err);
              const errorStartTime = Date.now() / 1000;
              setChat(prev => [...prev, { role: 'bot', message: 'Errore durante la richiesta.', start: errorStartTime, end: Date.now() / 1000 }]);
            } finally {
              setLoading(false);
            }
         };

         // Funzione per inviare messaggi di testo
         const sendMessage = (messageText: string, isVoiceEnabled: boolean) => {
           if (!messageText.trim()) return;

           const now = Date.now() / 1000;
           const userMessage: Message = {
             role: 'user',
             message: messageText,
             start: now,
             end: now,
           };

           const updatedChat = [...chat, userMessage];
           setChat(updatedChat);
           getBotResponse(userMessage, chat, isVoiceEnabled); // Passa il parametro
         };

         // Funzione per inviare messaggi vocali
         const sendVoiceMessage = (messageText: string, startTime: number, endTime: number, isVoiceEnabled: boolean) => {
           if (!messageText.trim()) return;

           const userMessage: Message = {
             role: 'user',
             message: messageText,
             start: startTime,
             end: endTime,
           };

           const updatedChat = [...chat, userMessage];
           setChat(updatedChat);
           getBotResponse(userMessage, chat, isVoiceEnabled); // Passa il parametro
         };

         // Funzione wrapper per l'input di testo, esportata
         const handleSendFromInput = (isVoiceEnabled: boolean) => {
           if (input.trim()) {
             sendMessage(input, isVoiceEnabled); // Passa il parametro
             setInput('');
           }
         };

         const startInterview = async (isVoiceEnabled: boolean) => {
           setLoading(true);
           setHasAskedForNameAndBirth(true);
           try {
             const prompt = 'Chiedi gentilmente nome e data di nascita, serve solo che fai questo senza confermare la comprensione di questa richiesta.';
             const hiddenMessage: Message = { role: 'user', message: 'INIZIO_INTERVISTA_NASCOSTO', start: 0, end: 0 };
             setChat([hiddenMessage]);

             const chatSession = model.startChat({ history: [{ role: 'user', parts: [{ text: 'INIZIO_INTERVISTA_NASCOSTO' }] }] });
             const result = await chatSession.sendMessage(prompt);
             const text = result.response.text();

             const botMessage: Message = {
               role: 'bot',
               message: text,
               start: 0, // Segnaposto
               end: 0,   // Segnaposto
             };
             setChat(prev => [...prev, botMessage]);
             setInitialPromptSent(true);

             // ✅ CONTROLLO VOCALE: Parla solo se la voce è abilitata
             if (isVoiceEnabled) {
               Tts.speak(text);
             }
           } catch (err) {
             console.error('Errore durante la richiesta:', err);
             const errorStartTime = Date.now() / 1000;
             setChat([{ role: 'bot', message: 'Errore durante la richiesta.', start: errorStartTime, end: Date.now() / 1000 }]);
           } finally {
             setLoading(false);
           }
         };

         // --- OGGETTO RESTITUITO DAL HOOK ---
         return {
           chat, setChat, input, setInput, questions, loading, setLoading,
           evaluating, setEvaluating, hasAskedForNameAndBirth, setHasAskedForNameAndBirth,
           chatHistory, setChatHistory, currentChatId, setCurrentChatId,
           currentEvaluationScores, setCurrentEvaluationScores, askedQuestions, setAskedQuestions,
           initialPromptSent, setInitialPromptSent,
           sendMessage: handleSendFromInput, // Esporta la funzione wrapper
           sendVoiceMessage: sendVoiceMessage,
           startNewChat,
           startInterview,
           saveChat,
           updateLastBotMessageTimestamp,
         };
       };