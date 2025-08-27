import { useState, useEffect, useRef, useCallback } from 'react';
import Voice2Text from 'react-native-voice2text';

export const useVoiceRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [hasFinishedSpeaking, setHasFinishedSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [speechStartTime, setSpeechStartTime] = useState(0);
  const [speechEndTime, setSpeechEndTime] = useState(0);

  const speechTimeout = useRef<NodeJS.Timeout | null>(null);

  const onResultsHandler = useCallback((result: { text: string }) => {
    const text = result.text || '';
    setRecognizedText(text);

    if (text.trim().length > 0) {
      if (speechTimeout.current) {
        clearTimeout(speechTimeout.current);
      }
      speechTimeout.current = setTimeout(() => {
        setSpeechEndTime(Date.now() / 1000);
        setHasFinishedSpeaking(true);
        setIsListening(false);
      }, 2000);
    }
  }, []);

  // ✅ GESTORE ERRORI "INTELLIGENTE"
  const onErrorHandler = useCallback((e: { message: string; code?: string }) => {
    const errorMessage = e.message || 'Errore sconosciuto';
    setError(errorMessage);
    setIsListening(false);

    // Se l'errore è dovuto al silenzio (es. "No match"),
    // lo trattiamo come un turno di parola "vuoto" e finito.
    if (errorMessage.includes('No match') || errorMessage.includes('No speech input')) {
      setRecognizedText('');
      setHasFinishedSpeaking(true); // Questo attiva la logica del bot in App.tsx
    }
  }, []);

  useEffect(() => {
    Voice2Text.onResults(onResultsHandler);
    Voice2Text.onError(onErrorHandler);

    return () => {
      Voice2Text.destroy();
    };
  }, [onResultsHandler, onErrorHandler]);

  const reset = () => {
    setIsListening(false);
    setRecognizedText('');
    setHasFinishedSpeaking(false);
    setError('');
    setSpeechStartTime(0);
    setSpeechEndTime(0);
    if (speechTimeout.current) {
      clearTimeout(speechTimeout.current);
    }
  };

  const startListening = async () => {
    reset();
    try {
      const granted = await Voice2Text.checkPermissions();
      if (granted) {
        await Voice2Text.startListening('it-IT');
        setIsListening(true);
        setSpeechStartTime(Date.now() / 1000);
      } else {
        setError('Permesso per il microfono negato.');
      }
    } catch (e: any) {
      console.error('Errore startListening:', e);
      setError(e.message);
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    try {
      await Voice2Text.stopListening();
    } catch (e: any) {
      console.error('Errore stopListening:', e);
    } finally {
      setIsListening(false);
    }
  };

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
    reset,
  };
};