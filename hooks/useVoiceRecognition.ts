// useVoiceRecognition.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';

export const useVoiceRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [hasFinishedSpeaking, setHasFinishedSpeaking] = useState(false);
  const [error, setError] = useState('');

  // --- STATI PER I TIMESTAMP ---
  const [speechStartTime, setSpeechStartTime] = useState(0);
  const [speechEndTime, setSpeechEndTime] = useState(0);

  const speechTimeout = useRef<NodeJS.Timeout | null>(null);

  const onSpeechResults = useCallback((e: SpeechResultsEvent) => {
    const text = e.value?.[0] || '';
    setRecognizedText(text);

    if (speechTimeout.current) {
      clearTimeout(speechTimeout.current);
    }
    // Timeout di 2 secondi per rilevare la fine del parlato
// in onSpeechResults...
    speechTimeout.current = setTimeout(() => {
      // ✅ SOTTRAI I 2 SECONDI DI TIMEOUT DAL TIMESTAMP FINALE
      setSpeechEndTime((Date.now() / 1000) - 2);
      setHasFinishedSpeaking(true);
    }, 2000);
  }, []);

  const onSpeechError = useCallback((e: SpeechErrorEvent) => {
    setError(JSON.stringify(e.error));
    setIsListening(false);
  }, []);

  // ✅ 1. NUOVA FUNZIONE DI RESET
  // Centralizza tutta la logica per pulire lo stato del microfono.
  const reset = () => {
    setIsListening(false);
    setRecognizedText('');
    setHasFinishedSpeaking(false);
    setError('');
    setSpeechStartTime(0);
    setSpeechEndTime(0);
  };

  const startListening = async () => {
    reset(); // ✅ 2. USA LA NUOVA FUNZIONE QUI per pulire tutto
    setIsListening(true); // E poi imposta solo lo stato di ascolto

    try {
      await Voice.start('it-IT');
      setSpeechStartTime(Date.now() / 1000);
    } catch (e) {
      console.error('Errore startListening:', e);
      setError(e.message);
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
    } catch (e) {
      console.error('Errore stopListening:', e);
    } finally {
      setIsListening(false);
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
  }, [onSpeechResults, onSpeechError]);

  return {
    isListening,
    recognizedText,
    hasFinishedSpeaking,
    error,
    speechStartTime,
    speechEndTime,
    startListening,
    stopListening,
    resetFinishedSpeaking: () => setHasFinishedSpeaking(false),
    reset, // ✅ 3. ESPONI LA NUOVA FUNZIONE per poterla usare in App.tsx
  };
};