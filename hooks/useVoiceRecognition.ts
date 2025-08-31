import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition as useVoicebox } from 'react-native-voicebox-speech-rec';

// Questa è la versione definitiva che cattura il timestamp preciso
// sia all'inizio (prima parola) sia alla fine (ultima parola).
export const useVoiceRecognition = () => {
  const {
    startSpeechRecognition,
    stopSpeechRecognition,
    speechContentRealTime,
    setSpeechRecErrorHandler,
    setSpeechRecStartedHandler,
    setSpeechRecCompletedHandler,
  } = useVoicebox();

  const [isListening, setIsListening] = useState(false);
  const [hasFinishedSpeaking, setHasFinishedSpeaking] = useState(false);
  const [error, setError] = useState('');

  // Timestamp
  const [speechStartTime, setSpeechStartTime] = useState(0);
  const [actualSpeechStartTime, setActualSpeechStartTime] = useState(0);
  const [speechEndTime, setSpeechEndTime] = useState(0);

  // 🧠 NUOVA LOGICA: Usiamo un ref per memorizzare il timestamp dell'ultima parola
  // Questo evita re-render inutili e ci dà il valore più aggiornato.
  const lastWordTimestampRef = useRef(0);

  // Timer per l'auto-invio
  const endSpeechTimer = useRef<NodeJS.Timeout | null>(null);

  const cleanupTimer = useCallback(() => {
    if (endSpeechTimer.current) clearTimeout(endSpeechTimer.current);
  }, []);

  // Handler per l'inizio: imposta solo l'inizio dell'ascolto
  useEffect(() => {
    setSpeechRecStartedHandler(() => {
      setIsListening(true);
      setHasFinishedSpeaking(false);
      const now = Date.now() / 1000;
      setSpeechStartTime(now);
      setActualSpeechStartTime(0);
      lastWordTimestampRef.current = now; // Inizializza il timestamp di fine a quello di inizio
    });
  }, [setSpeechRecStartedHandler]);

  // Handler per la fine: finalizza lo stato usando il timestamp salvato
  useEffect(() => {
    setSpeechRecCompletedHandler(() => {
      cleanupTimer();
      setIsListening(false);
      // ✅ USA IL TIMESTAMP DELL'ULTIMA PAROLA, NON Date.now()
      setSpeechEndTime(lastWordTimestampRef.current);
      setHasFinishedSpeaking(true);
    });
  }, [setSpeechRecCompletedHandler, cleanupTimer]);

  // Handler per gli errori
  useEffect(() => {
    setSpeechRecErrorHandler((errorMessage: string) => {
      cleanupTimer();
      setError(errorMessage);
      setIsListening(false);
      setHasFinishedSpeaking(true);
    });
  }, [setSpeechRecErrorHandler, cleanupTimer]);

  // Questo useEffect osserva il testo in tempo reale.
  useEffect(() => {
    if (!isListening) return;

    // Se il testo è apparso per la prima volta, cattura il timestamp di inizio parlato.
    if (speechContentRealTime && actualSpeechStartTime === 0) {
      const now = Date.now() / 1000;
      setActualSpeechStartTime(now);
      lastWordTimestampRef.current = now; // Aggiorna anche il timestamp di fine
    }

    // Se c'è del testo, aggiorna il timestamp dell'ultima parola e resetta il timer.
    if (speechContentRealTime) {
      // ✅ OGNI PAROLA AGGIORNA IL TIMESTAMP DI FINE
      lastWordTimestampRef.current = Date.now() / 1000;

      cleanupTimer();
      endSpeechTimer.current = setTimeout(() => {
        stopSpeechRecognition();
      }, 2000); // 2 secondi di silenzio
    }
  }, [speechContentRealTime, isListening, actualSpeechStartTime, stopSpeechRecognition, cleanupTimer]);

  // Funzioni esposte ad App.tsx
  const startListening = useCallback(() => {
    startSpeechRecognition('it-IT');
  }, [startSpeechRecognition]);

  const stopListening = useCallback(() => {
    cleanupTimer();
    stopSpeechRecognition();
  }, [stopSpeechRecognition, cleanupTimer]);

  const reset = useCallback(() => {
    cleanupTimer();
    setIsListening(false);
    setHasFinishedSpeaking(false);
    setError('');
  }, [cleanupTimer]);

  const resetFinishedSpeaking = useCallback(() => {
    setHasFinishedSpeaking(false);
  }, []);

  return {
    isListening,
    recognizedText: speechContentRealTime,
    hasFinishedSpeaking,
    error,
    speechStartTime,
    actualSpeechStartTime,
    speechEndTime,
    startListening,
    stopListening,
    resetFinishedSpeaking,
    reset,
  };
};

