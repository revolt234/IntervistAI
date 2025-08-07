import { useCallback } from 'react';
import { Alert } from 'react-native';
import JsonFileReader from '../android/app/src/services/JsonFileReader';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { API_KEY } from '@env';

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export const useEvaluationManager = ({
  chat,
  setChat,
  chatHistory,
  currentChatId,
  setEvaluating,
  setCurrentEvaluationScores,
  avgTimeResponse,
  avgResponseLength,
  counterInterruption
}) => {

  // ✅ 1. FUNZIONE HELPER PER CENTRALIZZARE LA LOGICA DEI SUGGERIMENTI
  const getHintsForProblem = (problem) => {
    let timeHint = '';
    let logorreaHint = '';

    // Logica per "Pensiero Rallentato"
    if (problem.fenomeno.toLowerCase().includes('rallentato') && avgTimeResponse !== undefined) {
      timeHint = `**Nota da menzionare sempre nella valutazione di Pensiero Rallentato: tempo medio delle risposte del paziente calcolato con metadati= ${avgTimeResponse.toFixed(2)}, se superiore a 2 secondi rafforza la presenza della problematica.\n`;
    }

    // Logica per "Logorrea"
    if (problem.fenomeno.toLowerCase().includes('logorrea')) {
      if (avgResponseLength !== undefined && counterInterruption !== undefined) {
        logorreaHint = `\n**Nota da menzionare sempre nella valutazione di Logorrea: Il paziente ha una lunghezza media delle risposte pari a **${avgResponseLength.toFixed(2)} parole**. Inoltre, interrompe il medico il **${(counterInterruption * 100).toFixed(1)}%** delle volte, queste metriche vanno considerate nell'assegnazione del punteggio.\n\n`;
      }
    }
    return { timeHint, logorreaHint };
  };


  // ✅ 2. VALUTAZIONE SINGOLA, ORA PIÙ PULITA
  const handleEvaluateSingleProblem = useCallback(async (selectedProblem) => {
    if (!selectedProblem || chat.length === 0) {
      Alert.alert('Attenzione', 'Seleziona un fenomeno da valutare');
      return;
    }

    // --- Logica degli Alert (specifica per la valutazione singola) ---
    if (selectedProblem.fenomeno.toLowerCase().includes('rallentato')) {
        if (avgTimeResponse !== undefined) {
            Alert.alert('⏱️ Metrica per Pensiero Rallentato', `Il paziente risponde in media in ${avgTimeResponse.toFixed(2)} secondi`);
        } else {
            Alert.alert('⚠️ Informazione mancante', 'avgTimeResponse non disponibile.');
        }
    }
    if (selectedProblem.fenomeno.toLowerCase().includes('logorrea')) {
        let alertMsg = '';
        if (avgResponseLength == null) alertMsg += '⚠️ Lunghezza media risposte NON disponibile.\n';
        else alertMsg += `🗣️ Lunghezza media risposte: ${avgResponseLength.toFixed(2)} parole\n`;

        if (counterInterruption == null) alertMsg += '⚠️ Interruzioni paziente NON disponibili.\n';
        else alertMsg += `🔁 Interruzioni paziente: ${(counterInterruption * 100).toFixed(1)}% delle domande\n`;

        Alert.alert('📊 Metriche per Logorrea', alertMsg.trim());
    }
    // --- Fine Logica Alert ---

    setEvaluating(true);

    try {
     const chatObj = chatHistory.find(c => c.id === currentChatId);
     const previousScore = chatObj?.evaluationScores?.[selectedProblem.fenomeno] ?? -1;

     // 🔔 Alert di debug per vedere il punteggio precedente
     Alert.alert(
       '🧠 Punteggio Precedente',
       previousScore >= 0
         ? `Il punteggio già assegnato per "${selectedProblem.fenomeno}" è: ${previousScore}`
         : 'Nessun punteggio precedente disponibile per questo fenomeno.'
     );


      // Usa la funzione helper per ottenere i suggerimenti
      const { timeHint, logorreaHint } = getHintsForProblem(selectedProblem);

      const prompt = `
- Problematica: ${selectedProblem.fenomeno}
- Descrizione: ${selectedProblem.descrizione}
- Esempio: ${selectedProblem.esempio}
- Punteggio TLDS: ${selectedProblem.punteggio}
${timeHint}${logorreaHint}
${previousScore >= 0 ? `\nNOTA da menzionare sempre: menziona sempre esplicitamente il valore precedente che è: '${previousScore}' (su una scala da 0 a 4), indicando se è maggiore o minore di quello attuale.` : ''}
**Se il tuo ultimo messaggio è una domanda, non considerare questa nella valutazione.**
**Valuta la presenza della problematica "${selectedProblem.fenomeno}" all'interno delle risposte del paziente, usando il seguente modello, nella risposta includi anche le note che ti ho appena fornito:**
**Modello di output:**
${selectedProblem.modello_di_output}
Conversazione completa:
${chat.map(msg => `${msg.role === 'user' ? 'PAZIENTE' : 'MEDICO'}: ${msg.message}`).join('\n')}
`;
      // ... resto della logica invariato
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const match = text.match(/Punteggio Assegnato:\s*([0-4])/i);

      if (match) {
        const newScore = parseInt(match[1]);
        setCurrentEvaluationScores(prev => ({ ...prev, [selectedProblem.fenomeno]: newScore }));
      }

      setChat(prev => [...prev, { role: 'bot', message: `**${selectedProblem.fenomeno}**\n${text}` }]);
    } catch (err) {
      console.error('Errore durante la valutazione:', err);
      Alert.alert('Errore', 'Valutazione fallita.');
    } finally {
      setEvaluating(false);
    }
  }, [chat, chatHistory, currentChatId, avgTimeResponse, avgResponseLength, counterInterruption]);


  // ✅ 3. VALUTAZIONE COMPLETA, ORA USA LA STESSA LOGICA
  const handleEvaluateProblems = useCallback(async () => {
    if (chat.length === 0) {
      Alert.alert('Attenzione', 'Non c\'è alcuna conversazione da valutare');
      return;
    }
    setEvaluating(true);

    try {
      // Mostra un unico alert riassuntivo con tutte le metriche disponibili
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
      if(hasMetrics) Alert.alert('📊 Info Generali', generalInfo.trim());

      const problemDetails = await JsonFileReader.getProblemDetails();
      const evaluations = [];

      for (const problem of problemDetails) {
        // Usa la funzione helper per ottenere i suggerimenti per ogni problema
        const { timeHint, logorreaHint } = getHintsForProblem(problem);

        const prompt = `
- Problematica: ${problem.fenomeno}
- Descrizione: ${problem.descrizione}
- Esempio: ${problem.esempio}
- Punteggio TLDS: ${problem.punteggio}
${timeHint}${logorreaHint}
**Se il tuo ultimo messaggio è una domanda, non considerare questa nella valutazione.**
**Valuta la presenza della problematica "${problem.fenomeno}" all'interno delle risposte del paziente, usando il seguente modello:**
- Modello di output: ${problem.modello_di_output}
Conversazione completa:
${chat.map(msg => `${msg.role === 'user' ? 'PAZIENTE' : 'MEDICO'}: ${msg.message}`).join('\n')}
`;
        // ... resto della logica invariato
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        evaluations.push({ problem: problem.fenomeno, evaluation: text || 'Nessuna valutazione disponibile.' });
      }

      const formatted = evaluations.map(e => `**${e.problem}**\n${e.evaluation}\n\n`).join('---\n');
      setChat(prev => [...prev, { role: 'bot', message: formatted }]);
    } catch (err) {
      console.error('Errore durante la valutazione:', err);
      Alert.alert('Errore', 'Errore nella generazione del report.');
    } finally {
      setEvaluating(false);
    }
  }, [chat, avgTimeResponse, avgResponseLength, counterInterruption]);

  const extractScoreFromText = (text: string): number => {
    const match = text.match(/Punteggio assegnato:\s*(\d)/i);
    if (match) {
      const score = parseInt(match[1]);
      return Math.max(0, Math.min(4, score));
    }
    return -1;
  };

  return {
      handleEvaluateSingleProblem,
      handleEvaluateProblems,
      extractScoreFromText
    };
  };
