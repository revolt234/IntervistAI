// useVoiceRecognition.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';

export const useVoiceRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [hasFinishedSpeaking, setHasFinishedSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [speechStartTime, setSpeechStartTime] = useState(0);
  const [speechEndTime, setSpeechEndTime] = useState(0);
  const speechTimeout = useRef<NodeJS.Timeout | null>(null);

  const onSpeechResults = useCallback((e: SpeechResultsEvent) => {
    const text = e.value?.[0] || '';
    setRecognizedText(text);

    // ✅ MODIFICA APPLICATA QUI
    // Avvia il timer per la fine del parlato solo se l'utente ha detto almeno una parola.
    if (text.trim().length > 0) {
      if (speechTimeout.current) {
        clearTimeout(speechTimeout.current);
      }
      speechTimeout.current = setTimeout(() => {
        setSpeechEndTime((Date.now() / 1000) - 2);
        setHasFinishedSpeaking(true);
      }, 2000);
    }
  }, []);

  const onSpeechError = useCallback((e: SpeechErrorEvent) => {
    setError(JSON.stringify(e.error));
    setIsListening(false);
  }, []);

  const onSpeechStart = useCallback(() => {
    setSpeechStartTime(Date.now() / 1000);
  }, []);

  const reset = () => {
    setIsListening(false);
    setRecognizedText('');
    setHasFinishedSpeaking(false);
    setError('');
    setSpeechStartTime(0);
    setSpeechEndTime(0);
  };

  const startListening = async () => {
    reset();
    setIsListening(true);
    try {
      await Voice.start('it-IT');
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
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechResults = onSpeechResults;

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
      if (speechTimeout.current) {
        clearTimeout(speechTimeout.current);
      }
    };
  }, [onSpeechStart, onSpeechResults, onSpeechError]);

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