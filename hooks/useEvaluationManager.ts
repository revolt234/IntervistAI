/* useEvaluationManager.ts */
import { useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import JsonFileReader from '../android/app/src/services/JsonFileReader';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { API_KEY } from '@env';

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export const useEvaluationManager = ({
  chat,
  setChat,
  chatHistory,
  currentChatId,
  setEvaluating,
  setCurrentEvaluationScores,
  avgTimeResponse,
  avgResponseLength,
  counterInterruption,
    avgSpeechRate,
    maxSpeechRate,
  setChatHistory, // <- serve per salvare e poi persistere
}) => {
  // Helper note dinamiche per fenomeno
  const getHintsForProblem = (problem) => {
    let timeHint = '';
    let logorreaHint = '';
    let speechRateHint = '';
  if (problem.fenomeno.toLowerCase().includes('discorso sotto pressione')) {
    if (avgSpeechRate !== undefined && maxSpeechRate !== undefined) {
      speechRateHint =
        `\n**Nota contenente le metriche da considerare e menzionare sempre nella valutazione di Discorso Sotto Pressione:** ` +
        `DATI DEL PAZIENTE:` +
        `Velocità media del parlato = ${avgSpeechRate.toFixed(2)} parole/s; ` +
        `Picco di velocità = ${maxSpeechRate.toFixed(2)} parole/s. ` +
        `Tu devi considerare che in media la velcità di conversazione si aggira intorno alle 130-150 parole al minuto, un range più elevato rafforza la presenza della problematica.\n\n`;
    }
  }
    if (problem.fenomeno.toLowerCase().includes('rallentato') && avgTimeResponse !== undefined) {
      timeHint =
        `**Nota contenente le metriche da considerare e menzionare sempre nella valutazione di Pensiero Rallentato: ` +
        `tempo medio delle risposte del paziente calcolato con metadati = ${avgTimeResponse.toFixed(2)}s. ` +
        `Se > 2 secondi rafforza la presenza della problematica.**\n`;
    }

    if (problem.fenomeno.toLowerCase().includes('logorrea')) {
      if (avgResponseLength !== undefined && counterInterruption !== undefined) {
        logorreaHint =
          `\n**Nota contenente le metriche da considerare e menzionare sempre nella valutazione di Logorrea:** ` +
          `Lunghezza media risposte ${avgResponseLength.toFixed(2)} parole; ` +
          `interrompe il medico nel ${(counterInterruption * 100).toFixed(1)}% dei casi. ` +
          `Considera queste metriche nell'assegnazione del punteggio.\n\n`;
      }
    }
   return { timeHint, logorreaHint, speechRateHint }; // Aggiungi speechRateHint
  };

  // ------- Valutazione singolo fenomeno -------
  const handleEvaluateSingleProblem = useCallback(async (selectedProblem) => {
    if (!selectedProblem || chat.length === 0) {
      Alert.alert('Attenzione', 'Seleziona un fenomeno da valutare');
      return;
    }

    // Alert metriche dedicate
    if (selectedProblem.fenomeno.toLowerCase().includes('rallentato')) {
      if (avgTimeResponse !== undefined) {
        Alert.alert('⏱️ Metrica per Pensiero Rallentato', `Tempo medio risposte: ${avgTimeResponse.toFixed(2)}s`);
      } else {
        Alert.alert('⚠️ Informazione mancante', 'avgTimeResponse non disponibile.');
      }
    }
if (selectedProblem.fenomeno.toLowerCase().includes('discorso sotto pressione')) {
  let msg = '';
  msg += avgSpeechRate == null
    ? '⚠️ Velocità media parlato NON disponibile.\n'
    : `⚡️ Velocità media parlato: ${avgSpeechRate.toFixed(2)} parole/s\n`;
  msg += maxSpeechRate == null
    ? '⚠️ Picco velocità parlato NON disponibile.\n'
    : `🚀 Picco velocità parlato: ${maxSpeechRate.toFixed(2)} parole/s\n`;
  Alert.alert('📊 Metriche per Discorso Sotto Pressione', msg.trim());
}
    if (selectedProblem.fenomeno.toLowerCase().includes('logorrea')) {
      let msg = '';
      msg += avgResponseLength == null
        ? '⚠️ Lunghezza media risposte NON disponibile.\n'
        : `🗣️ Lunghezza media risposte: ${avgResponseLength.toFixed(2)} parole\n`;
      msg += counterInterruption == null
        ? '⚠️ Interruzioni paziente NON disponibili.\n'
        : `🔁 Interruzioni paziente: ${(counterInterruption * 100).toFixed(1)}% delle domande\n`;
      Alert.alert('📊 Metriche per Logorrea', msg.trim());
    }

    setEvaluating(true);

    try {
      const chatObj = chatHistory.find(c => c.id === currentChatId);
      const previousScore = chatObj?.evaluationScores?.[selectedProblem.fenomeno] ?? -1;

      // ✅ Manteniamo questo alert (lo volevi conservare)
      Alert.alert(
        '🧠 Punteggio Precedente',
        previousScore >= 0
          ? `Il punteggio già assegnato per "${selectedProblem.fenomeno}" è: ${previousScore}`
          : 'Nessun punteggio precedente disponibile per questo fenomeno.'
      );

      const { timeHint, logorreaHint, speechRateHint } = getHintsForProblem(selectedProblem);

      const prompt = `
- Problematica: ${selectedProblem.fenomeno}
- Descrizione: ${selectedProblem.descrizione}
- Esempio: ${selectedProblem.esempio}
- Punteggio TLDS: ${selectedProblem.punteggio}
${timeHint}${logorreaHint}${speechRateHint}
${previousScore >= 0
  ? `\nNOTA: menziona sempre esplicitamente il valore precedente '${previousScore}' (0–4) e se è maggiore/minore dell’attuale.`
  : ''
}
**Se il tuo ultimo messaggio è una domanda, non considerare questa nella valutazione.**
**Valuta la presenza della problematica "${selectedProblem.fenomeno}" nelle risposte del paziente, usando il seguente modello e includendo le note fornite:**
**Modello di output:**
${selectedProblem.modello_di_output}

Conversazione completa:
${chat.map(m => `${m.role === 'user' ? 'PAZIENTE' : 'MEDICO'}: ${m.message}`).join('\n')}
`;

      // Chiamata al modello
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Estrai punteggio 0..4
      const newScore = extractScoreFromText(text);

      if (newScore >= 0) {
        // 1) aggiorna punteggi correnti
        setCurrentEvaluationScores(prev => ({ ...prev, [selectedProblem.fenomeno]: newScore }));

        // 2) salva su chatHistory (append, non overwrite) + persisti
        const idx = chatHistory.findIndex(c => c.id === currentChatId);
        if (idx !== -1) {
          const updated = [...chatHistory];
          const curr = { ...updated[idx] };

          curr.evaluationLog = curr.evaluationLog ?? {};
          const list = curr.evaluationLog[selectedProblem.fenomeno] ?? [];
          list.push({ score: newScore, timestamp: Date.now() }); // <- APPEND, non overwrite
          curr.evaluationLog[selectedProblem.fenomeno] = list;

          curr.evaluationScores = {
            ...curr.evaluationScores,
            [selectedProblem.fenomeno]: newScore,
          };

          updated[idx] = curr;
          setChatHistory(updated);
          try {
            await AsyncStorage.setItem('chatHistory', JSON.stringify(updated));
          } catch (e) {
            console.warn('Persistenza chatHistory fallita:', e);
          }

          // 🔎 DEBUG: stampa TUTTO lo storico aggiornato
          Alert.alert(
            `DEBUG singolo • ${selectedProblem.fenomeno}`,
            `Nuovo punteggio: ${newScore}\n\nevaluationLog:\n${JSON.stringify(curr.evaluationLog, null, 2)}`
          );
          console.log('DEBUG [single] saved score', selectedProblem.fenomeno, newScore);
          console.log('DEBUG [single] evaluationLog', curr.evaluationLog);
        }
      }

      // 3) append messaggio col testo della valutazione
      setChat(prev => [...prev, { role: 'bot', message: `**${selectedProblem.fenomeno}**\n${text}` }]);
    } catch (err) {
      console.error('Errore durante la valutazione:', err);
      Alert.alert('Errore', 'Valutazione fallita.');
    } finally {
      setEvaluating(false);
    }
  }, [
    chat,
    chatHistory,
    currentChatId,
    avgTimeResponse,
    avgResponseLength,
    counterInterruption,
    avgSpeechRate, // <-- AGGIUNGI
    maxSpeechRate, // <-- AGGIUNGI
    setEvaluating,
    setCurrentEvaluationScores,
    setChatHistory,
  ]);

  // ------- Valutazione completa (tutti i fenomeni) -------
  const handleEvaluateProblems = useCallback(async () => {
    if (chat.length === 0) {
      Alert.alert('Attenzione', 'Non c’è alcuna conversazione da valutare');
      return;
    }

    setEvaluating(true);

    try {
      // Riepilogo metriche
      let generalInfo = 'Metriche generali disponibili per la valutazione:\n\n';
      let hasMetrics = false;
      if (avgTimeResponse !== undefined) {
        generalInfo += `⏱️ Tempo medio risposta: ${avgTimeResponse.toFixed(2)}s\n`;
        hasMetrics = true;
      }
      if (avgResponseLength !== undefined) {
        generalInfo += `🗣️ Lunghezza media risposte: ${avgResponseLength.toFixed(2)} parole\n`;
        hasMetrics = true;
      }
      if (counterInterruption !== undefined) {
        generalInfo += `🔁 Tasso interruzioni: ${(counterInterruption * 100).toFixed(1)}%\n`;
        hasMetrics = true;
      }
      if (hasMetrics) Alert.alert('📊 Info Generali', generalInfo.trim());

      const problemDetails = await JsonFileReader.getProblemDetails();
      const evaluations: Array<{ problem: string; evaluation: string }> = [];

      const newCurrentScores: { [fenomeno: string]: number } = {};

      for (const problem of problemDetails) {
        const { timeHint, logorreaHint, speechRateHint } = getHintsForProblem(problem);

        const prompt = `
- Problematica: ${problem.fenomeno}
- Descrizione: ${problem.descrizione}
- Esempio: ${problem.esempio}
- Punteggio TLDS: ${problem.punteggio}
${timeHint}${logorreaHint}${speechRateHint}
**Se il tuo ultimo messaggio è una domanda, non considerare questa nella valutazione.**
**Valuta la presenza della problematica "${problem.fenomeno}" all'interno delle risposte del paziente, usando il seguente modello:**
- Modello di output: ${problem.modello_di_output}

Conversazione completa:
${chat.map(m => `${m.role === 'user' ? 'PAZIENTE' : 'MEDICO'}: ${m.message}`).join('\n')}
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text() || 'Nessuna valutazione disponibile.';
        evaluations.push({ problem: problem.fenomeno, evaluation: text });

        const score = extractScoreFromText(text);
        if (score >= 0) {
          newCurrentScores[problem.fenomeno] = score;

          const idx = chatHistory.findIndex(c => c.id === currentChatId);
          if (idx !== -1) {
            const updated = [...chatHistory];
            const curr = { ...updated[idx] };

            curr.evaluationLog = curr.evaluationLog ?? {};
            const list = curr.evaluationLog[problem.fenomeno] ?? [];
            list.push({ score, timestamp: Date.now() }); // <- APPEND
            curr.evaluationLog[problem.fenomeno] = list;

            curr.evaluationScores = { ...curr.evaluationScores, [problem.fenomeno]: score };

            updated[idx] = curr;
            setChatHistory(updated);
            try {
              await AsyncStorage.setItem('chatHistory', JSON.stringify(updated));
            } catch (e) {
              console.warn('Persistenza chatHistory fallita (bulk):', e);
            }

            // 🔎 DEBUG per ogni fenomeno
            Alert.alert(
              `DEBUG bulk • ${problem.fenomeno}`,
              `Nuovo punteggio: ${score}\n\nevaluationLog:\n${JSON.stringify(curr.evaluationLog, null, 2)}`
            );
            console.log('DEBUG [bulk] saved score', problem.fenomeno, score);
            console.log('DEBUG [bulk] evaluationLog', curr.evaluationLog);
          }
        }
      }

      if (Object.keys(newCurrentScores).length > 0) {
        setCurrentEvaluationScores(prev => ({ ...prev, ...newCurrentScores }));
      }

      const formatted = evaluations
        .map(e => `**${e.problem}**\n${e.evaluation}\n\n`)
        .join('---\n');

      setChat(prev => [...prev, { role: 'bot', message: formatted }]);
    } catch (err) {
      console.error('Errore nella generazione del report:', err);
      Alert.alert('Errore', 'Errore nella generazione del report.');
    } finally {
      setEvaluating(false);
    }
 }, [
   chat,
   chatHistory,
   currentChatId,
   avgTimeResponse,
   avgResponseLength,
   counterInterruption,
   avgSpeechRate, // <-- AGGIUNGI
   maxSpeechRate, // <-- AGGIUNGI
   setEvaluating,
   setCurrentEvaluationScores,
   setChatHistory,
 ]);

  // Estrazione punteggio (accetta "Assegnato" o "assegnato")
  const extractScoreFromText = (text: string): number => {
    const match = text.match(/Punteggio\s*[Aa]ssegnato:\s*([0-4])/);
    if (!match) return -1;
    const score = parseInt(match[1], 10);
    return Number.isNaN(score) ? -1 : Math.max(0, Math.min(4, score));
  };

  return {
    handleEvaluateSingleProblem,
    handleEvaluateProblems,
    extractScoreFromText,
  };
};
