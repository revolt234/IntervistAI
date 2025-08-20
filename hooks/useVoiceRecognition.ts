import { useState, useEffect, useRef } from 'react';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';

export const useVoiceRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [hasFinishedSpeaking, setHasFinishedSpeaking] = useState(false);
  const [error, setError] = useState('');

  // --- NUOVI STATI PER I TIMESTAMP ---
  const [speechStartTime, setSpeechStartTime] = useState(0);
  const [speechEndTime, setSpeechEndTime] = useState(0);
  // ------------------------------------

  const speechTimeout = useRef<NodeJS.Timeout | null>(null);

  const onSpeechResults = (e: SpeechResultsEvent) => {
    const text = e.value?.[0] || '';
    setRecognizedText(text);

    if (speechTimeout.current) {
      clearTimeout(speechTimeout.current);
    }
    speechTimeout.current = setTimeout(() => {
      // Quando l'utente smette di parlare, registriamo l'ora di fine
      setSpeechEndTime(Date.now() / 1000);
      setHasFinishedSpeaking(true);
    }, 4000);
  };

  const onSpeechError = (e: SpeechErrorEvent) => {
    setError(JSON.stringify(e.error));
  };

  const startListening = async () => {
    // Resettiamo tutti gli stati prima di iniziare
    setIsListening(true);
    setRecognizedText('');
    setHasFinishedSpeaking(false);
    setError('');
    setSpeechStartTime(0); // Resetta timestamp
    setSpeechEndTime(0);   // Resetta timestamp

    try {
      await Voice.start('it-IT');
      // Quando l'ascolto inizia, registriamo l'ora di inizio
      setSpeechStartTime(Date.now() / 1000);
    } catch (e) {
      console.error('Errore startListening:', e);
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
      setIsListening(false);
    } catch (e) {
      console.error('Errore stopListening:', e);
    }
  };

  useEffect(() => {
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechResults = onSpeechResults;

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
      if (speechTimeout.current) {
        clearTimeout(speechTimeout.current);
      }
    };
  }, []);

  return {
    isListening,
    recognizedText,
    hasFinishedSpeaking,
    error,
    speechStartTime, // <-- Esponiamo il nuovo stato
    speechEndTime,   // <-- Esponiamo il nuovo stato
    startListening,
    stopListening,
    resetFinishedSpeaking: () => setHasFinishedSpeaking(false),
  };
};