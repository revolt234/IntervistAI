// useVoiceRecognition.ts (aggiornato per react-native-voice2text)

import { useState, useEffect, useRef, useCallback } from 'react';
import Voice2Text from 'react-native-voice2text';

export const useVoiceRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [hasFinishedSpeaking, setHasFinishedSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [speechStartTime, setSpeechStartTime] = useState(0);
  const [speechEndTime, setSpeechEndTime] = useState(0);

  // 1. RIPRISTINATA LA TUA LOGICA ORIGINALE DEL setTimeout
  // Dato che la libreria non ha un evento onEnd, questo è il modo corretto
  // per sapere quando l'utente ha finito di parlare.
  const speechTimeout = useRef<NodeJS.Timeout | null>(null);

  // onResults: chiamato con il testo riconosciuto
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
        setIsListening(false); // Smettiamo di ascoltare dopo il timeout
      }, 2000); // 2 secondi di silenzio per considerare finita la frase
    }
  }, []);

  // onError: chiamato in caso di errore
  const onErrorHandler = useCallback((e: { message: string }) => {
    setError(e.message || 'Errore sconosciuto');
    setIsListening(false);
  }, []);

  // useEffect: registra e pulisce gli eventi
  useEffect(() => {
    // 2. EVENTI CORRETTI: Registriamo solo gli eventi che la libreria fornisce.
    const resultsSubscription = Voice2Text.onResults(onResultsHandler);
    const errorSubscription = Voice2Text.onError(onErrorHandler);

    return () => {
      resultsSubscription.remove();
      errorSubscription.remove();
    };
  }, [onResultsHandler, onErrorHandler]);

  // Funzione per resettare lo stato
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

  // Funzione per avviare l'ascolto
  const startListening = async () => {
    reset();
    try {
      // 3. CONTROLLO PERMESSI E METODO CORRETTO
      const granted = await Voice2Text.checkPermissions();
      if (granted) {
        await Voice2Text.startListening('it-IT');
        // 4. GESTIONE MANUALE DELLO STATO "isListening"
        // Poiché non c'è onStart, lo impostiamo noi qui.
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

  // Funzione per fermare l'ascolto
  const stopListening = async () => {
    try {
      // 5. METODO CORRETTO
      await Voice2Text.stopListening();
    } catch (e: any) {
      console.error('Errore stopListening:', e);
    } finally {
      setIsListening(false);
    }
  };

  // Valori e funzioni restituiti dall'hook
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