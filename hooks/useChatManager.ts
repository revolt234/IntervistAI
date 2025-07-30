import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Tts from 'react-native-tts';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { API_KEY } from '@env';
import JsonFileReader from '../android/app/src/services/JsonFileReader';

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export interface Message {
  role: 'user' | 'bot';
  message: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  evaluationScores: { [fenomeno: string]: number };
}

export const useChatManager = () => {
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

  useEffect(() => {
    Tts.getInitStatus().then(() => Tts.setDefaultLanguage('it-IT'));
    JsonFileReader.getRandomMedicalQuestions().then(setQuestions).catch(console.error);
    AsyncStorage.getItem('chatHistory').then(data => {
      if (data) setChatHistory(JSON.parse(data));
    });
  }, []);

  useEffect(() => {
    if (chat.length > 0 && chat[chat.length - 1].role === 'bot') {
      const text = chat[chat.length - 1].message;
      if (!text.includes("Con quale frequenza") && !text.includes("crea disagio?")) {
        setAskedQuestions(prev => [...prev, text]);
      }
    }
  }, [chat]);

  useEffect(() => {
    if (chat.length > 0) saveChat();
  }, [chat]);

  useEffect(() => {
    if (chatHistory.length > 0) {
      AsyncStorage.setItem('chatHistory', JSON.stringify(chatHistory)).catch(console.error);
    }
  }, [chatHistory]);

  const saveChat = () => {
    if (chat.length === 0) return;
    const firstUserMsg = chat.find(msg => msg.role === 'user' && !msg.message.includes('INIZIO_INTERVISTA_NASCOSTO'));
    const title = firstUserMsg
      ? firstUserMsg.message.slice(0, 30) + (firstUserMsg.message.length > 30 ? '...' : '')
      : 'Nuova conversazione';

    const updatedChat: Chat = {
      id: currentChatId,
      title,
      messages: [...chat],
      createdAt: new Date().toISOString(),
      evaluationScores: currentEvaluationScores,
    };

    setChatHistory(prev => {
      const idx = prev.findIndex(c => c.id === currentChatId);
      if (idx >= 0) {
        const newHistory = [...prev];
        newHistory[idx] = updatedChat;
        return newHistory;
      } else {
        return [updatedChat, ...prev];
      }
    });
  };

  const startNewChat = () => {
    Tts.stop();
    if (chat.length > 0) saveChat();
    setChat([]);
    setInput('');
    setHasAskedForNameAndBirth(false);
    setCurrentChatId(Date.now().toString());
    setAskedQuestions([]);
    setInitialPromptSent(false);
    const scores: { [key: string]: number } = {};
    setCurrentEvaluationScores(scores);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', message: input };
    setChat(prev => {
      if (!initialPromptSent && prev[0]?.message === 'INIZIO_INTERVISTA_NASCOSTO') {
        return [...prev.slice(1), userMessage];
      }
      return [...prev, userMessage];
    });

    setLoading(true);

    try {
      const history = chat.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.message }],
      }));
      history.push({ role: 'user', parts: [{ text: input }] });

      let prompt = '';
      if (!hasAskedForNameAndBirth) {
        prompt = 'Chiedimi gentilmente nome e data di nascita.';
        setHasAskedForNameAndBirth(true);
      } else {
        const unanswered = questions.filter(q => !askedQuestions.includes(q));
        const nextQuestion = unanswered[0];
        prompt = nextQuestion || 'Grazie per aver risposto, le domande sono finite.';
      }

      const chatSession = model.startChat({ history });
      const result = await chatSession.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();

      setChat(prev => [...prev, { role: 'bot', message: text }]);
      setInitialPromptSent(true);
    } catch (err) {
      console.error('Errore durante la richiesta:', err);
      setChat(prev => [...prev, { role: 'bot', message: 'Errore durante la richiesta.' }]);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const startInterview = async () => {
    setLoading(true);
    setHasAskedForNameAndBirth(true);

    try {
      const prompt = 'Chiedi gentilmente nome e data di nascita, serve solo che fai questo senza confermare la comprensione di questa richiesta.';
      const hiddenMessage: Message = { role: 'user', message: 'INIZIO_INTERVISTA_NASCOSTO' };
      setChat([hiddenMessage]);

      const chatSession = model.startChat({
        history: [{
          role: 'user',
          parts: [{ text: 'INIZIO_INTERVISTA_NASCOSTO' }],
        }],
      });

      const result = await chatSession.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();

      setChat(prev => [...prev, { role: 'bot', message: text }]);
      setInitialPromptSent(true);
    } catch (err) {
      console.error('Errore durante la richiesta:', err);
      setChat([{ role: 'bot', message: 'Errore durante la richiesta.' }]);
    } finally {
      setLoading(false);
    }
  };

  return {
    chat,
    setChat,
    input,
    setInput,
    questions,
    loading,
    setLoading,
    evaluating,
    setEvaluating,
    hasAskedForNameAndBirth,
    setHasAskedForNameAndBirth,
    chatHistory,
    setChatHistory,
    currentChatId,
    setCurrentChatId,
    currentEvaluationScores,
    setCurrentEvaluationScores,
    askedQuestions,
    setAskedQuestions,
    initialPromptSent,
    setInitialPromptSent,
    sendMessage,
    startNewChat,
    startInterview,
    saveChat,
  };
};
