import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition as useVoicebox } from 'react-native-voicebox-speech-rec';

/**
 * @description Hook custom per la gestione del riconoscimento vocale.
 * Cattura l'audio, gestisce gli stati (ascolto, errore, fine) e calcola
 * con precisione i timestamp di inizio e fine del parlato dell'utente.
 * Utilizza un timer per fermare automaticamente l'ascolto dopo un periodo di silenzio.
 */
export const useVoiceRecognition = () => {
  // --- INTEGRAZIONE CON LA LIBRERIA ESTERNA ---
  // Si estraggono le funzioni principali dalla libreria 'react-native-voicebox-speech-rec'.
  const {
    startSpeechRecognition,      // Funzione per avviare il riconoscimento
    stopSpeechRecognition,       // Funzione per fermarlo manualmente
    speechContentRealTime,       // Stringa con il testo riconosciuto in tempo reale
    setSpeechRecErrorHandler,    // Callback per quando si verifica un errore
    setSpeechRecStartedHandler,  // Callback per quando l'ascolto inizia
    setSpeechRecCompletedHandler,// Callback per quando l'ascolto finisce
  } = useVoicebox();

  // --- STATI DEL COMPONENTE ---
  // Questi stati (useState) servono a far ri-renderizzare il componente che usa l'hook
  // quando il loro valore cambia, mostrando così l'UI aggiornata.

  // `true` se il microfono è attivo e in ascolto.
  const [isListening, setIsListening] = useState(false);
  // `true` quando il ciclo di ascolto è terminato (sia con successo che con errore).
  const [hasFinishedSpeaking, setHasFinishedSpeaking] = useState(false);
  // Contiene eventuali messaggi di errore restituiti dalla libreria.
  const [error, setError] = useState('');

  // --- GESTIONE DEI TIMESTAMP ---

  // Timestamp di quando viene chiamato `startListening`. Non è l'inizio del parlato.
  const [speechStartTime, setSpeechStartTime] = useState(0);
  // Timestamp esatto di quando la PRIMA parola viene rilevata.
  const [actualSpeechStartTime, setActualSpeechStartTime] = useState(0);
  // Timestamp esatto di quando l'ULTIMA parola è stata rilevata.
  const [speechEndTime, setSpeechEndTime] = useState(0);

  // --- RIFERIMENTI (useRef) ---
  // I `ref` sono "contenitori" il cui valore persiste tra i render, ma la cui modifica
  // NON causa un nuovo render. Sono perfetti per memorizzare valori tecnici come ID di timer
  // o dati che devono essere aggiornati frequentemente senza impattare l'UI.

  // 🧠 LOGICA CHIAVE: Memorizza il timestamp dell'ultima parola rilevata.
  // Viene aggiornato ad ogni parola, ma non causa re-render, rendendolo efficientissimo.
  const lastWordTimestampRef = useRef(0);

  // Mantiene un riferimento al timer che ferma l'ascolto dopo un periodo di silenzio.
  // Serve per poterlo "pulire" (cancellare) se l'utente ricomincia a parlare.
  const endSpeechTimer = useRef<NodeJS.Timeout | null>(null);

  // --- FUNZIONI DI UTILITÀ ---

  // Funzione per cancellare il timer di auto-spegnimento.
  // Usata per evitare che `stopSpeechRecognition` venga chiamato se non necessario.
  const cleanupTimer = useCallback(() => {
    if (endSpeechTimer.current) clearTimeout(endSpeechTimer.current);
  }, []);

  // --- HOOKS (useEffect) ---
  // Questi blocchi di codice reagiscono ai cambiamenti di stato o all'inizializzazione del componente.
  // Qui vengono usati per "agganciare" le nostre funzioni di logica ai callback della libreria.

  // Si attiva quando l'ascolto inizia (callback `onStarted`).
  useEffect(() => {
    setSpeechRecStartedHandler(() => {
      setIsListening(true);
      setHasFinishedSpeaking(false);
      const now = Date.now() / 1000;
      setSpeechStartTime(now); // Imposta l'ora di inizio "tecnica".
      setActualSpeechStartTime(0); // Resetta a 0, che funge da flag "non ho ancora sentito nulla".
      lastWordTimestampRef.current = now; // Inizializza il timestamp di fine con l'ora attuale.
    });
  }, [setSpeechRecStartedHandler]);

  // Si attiva quando l'ascolto è completato con successo (callback `onCompleted`).
  useEffect(() => {
    setSpeechRecCompletedHandler(() => {
      cleanupTimer(); // Pulisce eventuali timer rimasti attivi.
      setIsListening(false);
      // ✅ USA IL TIMESTAMP DELL'ULTIMA PAROLA, che abbiamo salvato nel ref.
      // Questo è molto più preciso di `Date.now()`, che includerebbe il tempo di silenzio.
      setSpeechEndTime(lastWordTimestampRef.current);
      setHasFinishedSpeaking(true); // Segnala al componente che il ciclo è finito.
    });
  }, [setSpeechRecCompletedHandler, cleanupTimer]);

  // Si attiva in caso di errore (callback `onError`).
  useEffect(() => {
    setSpeechRecErrorHandler((errorMessage: string) => {
      cleanupTimer();
      setError(errorMessage); // Salva l'errore per mostrarlo all'utente.
      setIsListening(false);
      setHasFinishedSpeaking(true); // Anche un errore conclude il ciclo di ascolto.
    });
  }, [setSpeechRecErrorHandler, cleanupTimer]);

  // 🧠 EFFETTO PRINCIPALE: si attiva ogni volta che `speechContentRealTime` cambia.
  // Questo è il cuore della logica di cattura dei timestamp.
  useEffect(() => {
    // Non fare nulla se non siamo in ascolto.
    if (!isListening) return;

    // --- BLOCCO 1: Cattura il timestamp della PRIMA parola ---
    // La condizione `actualSpeechStartTime === 0` è vera solo una volta per ciclo.
    if (speechContentRealTime && actualSpeechStartTime === 0) {
      const now = Date.now() / 1000;
      // Imposta il timestamp di inizio del parlato reale. Una volta impostato, non cambierà più.
      setActualSpeechStartTime(now);
      // Aggiorna anche il ref, così il primo valore di fine coincide con l'inizio.
      lastWordTimestampRef.current = now;
    }

    // --- BLOCCO 2: Aggiorna il timestamp dell'ULTIMA parola e gestisce il silenzio ---
    // Questo blocco si esegue se c'è del testo riconosciuto.
    if (speechContentRealTime) {
      // ✅ Ad ogni nuova parola, sovrascrivi il ref con il timestamp attuale.
      lastWordTimestampRef.current = Date.now() / 1000;

      // Pulisci il timer precedente.
      cleanupTimer();
      // Avvia un nuovo timer. Se per 2 secondi non arrivano nuove parole,
      // la funzione `stopSpeechRecognition` verrà chiamata, terminando l'ascolto.
      endSpeechTimer.current = setTimeout(() => {
        stopSpeechRecognition();
      }, 2000); // 2 secondi di silenzio per terminare.
    }
  }, [speechContentRealTime, isListening, actualSpeechStartTime, stopSpeechRecognition, cleanupTimer]);

  // --- FUNZIONI ESPOSTE ---
  // Queste sono le funzioni che il componente che usa l'hook (es. App.tsx) potrà chiamare.

  // Avvia il processo di riconoscimento vocale.
  const startListening = useCallback(() => {
    startSpeechRecognition('it-IT'); // Imposta la lingua italiana.
  }, [startSpeechRecognition]);

  // Ferma manualmente il riconoscimento vocale.
  const stopListening = useCallback(() => {
    cleanupTimer(); // Pulisce il timer per evitare chiamate duplicate.
    stopSpeechRecognition();
  }, [stopSpeechRecognition, cleanupTimer]);

  // Resetta completamente lo stato del microfono. Utile per pulire l'UI.
  const reset = useCallback(() => {
    cleanupTimer();
    setIsListening(false);
    setHasFinishedSpeaking(false);
    setError('');
    // NOTA: Non resetta `recognizedText` perché quello è gestito dalla libreria.
    // L'UI si pulirà perché `isListening` diventa `false`.
  }, [cleanupTimer]);

  // Funzione specifica per resettare solo il flag `hasFinishedSpeaking`.
  // Permette al componente di gestire l'evento di "fine parlato" e poi resettarlo.
  const resetFinishedSpeaking = useCallback(() => {
    setHasFinishedSpeaking(false);
  }, []);

  // L'hook restituisce un oggetto con tutti gli stati e le funzioni necessari
  // per controllare e visualizzare il processo di riconoscimento vocale.
  return {
    isListening,                // Lo stato del microfono (attivo/spento)
    recognizedText: speechContentRealTime, // Il testo trascritto
    hasFinishedSpeaking,        // Flag che indica la fine del ciclo di ascolto
    error,                      // Eventuale messaggio di errore
    speechStartTime,            // Timestamp di accensione microfono
    actualSpeechStartTime,      // Timestamp della prima parola
    speechEndTime,              // Timestamp dell'ultima parola
    startListening,             // Funzione per avviare l'ascolto
    stopListening,              // Funzione per fermare l'ascolto
    resetFinishedSpeaking,      // Funzione per resettare il flag di fine
    reset,                      // Funzione per un reset completo
  };
};
