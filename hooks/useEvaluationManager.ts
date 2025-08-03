import { useCallback } from 'react';
import { Alert } from 'react-native';
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
  avgResponseLength,       // ✅ nuovo
  counterInterruption       // ✅ nuovo
}) => {

  const handleEvaluateSingleProblem = useCallback(async (selectedProblem) => {
    if (!selectedProblem || chat.length === 0) {
      Alert.alert('Attenzione', 'Seleziona un fenomeno da valutare');
      return;
    }

    const chatObj = chatHistory.find(c => c.id === currentChatId);
    const previousScore = chatObj?.evaluationScores?.[selectedProblem.fenomeno] ?? -1;

    if (avgTimeResponse == undefined)  {
      Alert.alert('⚠️ Informazione mancante', 'avgTimeResponse non disponibile per questa chat.');
    }

    const isLogorrea = selectedProblem.fenomeno.toLowerCase().includes('logorrea');
    let timeHint = '';
    let logorreaHint = '';

    if (selectedProblem.fenomeno.toLowerCase().includes('rallentato') && avgTimeResponse !== undefined) {
        Alert.alert('⏱️ Tempo medio di risposta', `Il paziente risponde in media in ${avgTimeResponse.toFixed(2)} secondi`);
      timeHint = `**Nota da menzionare nella valutazione di Pensiero Rallentato:** Il paziente impiega in media **${avgTimeResponse.toFixed(2)} secondi** per rispondere alle domande del medico, questa metrica va considerata in maniera adeguata e pesata nell'assegnazione del punteggio.\n\n`;
    }

    if (isLogorrea) {
      let alertMsg = '';

      if (avgResponseLength == null) {
        alertMsg += '⚠️ Lunghezza media delle risposte NON disponibile.\n';
      } else {
        alertMsg += `🗣️ Lunghezza media risposte: ${avgResponseLength.toFixed(2)} parole\n`;
      }

      if (counterInterruption == null) {
        alertMsg += '⚠️ Interruzioni del paziente NON disponibili.\n';
      } else {
        alertMsg += `🔁 Interruzioni del paziente: ${(counterInterruption * 100).toFixed(1)}% delle domande\n`;
      }

      Alert.alert('📊 Metriche per logorrea', alertMsg.trim());

      if (avgResponseLength !== undefined && counterInterruption !== undefined) {
        logorreaHint = `\n**Nota da menzionare nella valutazione di Logorrea:** Il paziente ha una lunghezza media delle risposte pari a **${avgResponseLength.toFixed(2)} parole**. Inoltre, interrompe il medico il **${(counterInterruption * 100).toFixed(1)}%** delle volte, queste metriche  considerate nell'assegnazione del punteggio.\n\n`;
      }
    }

    setEvaluating(true);

    try {
      const prompt = `
- Problematica: ${selectedProblem.fenomeno}
- Descrizione: ${selectedProblem.descrizione}
- Esempio: ${selectedProblem.esempio}
- Punteggio TLDS: ${selectedProblem.punteggio}
${timeHint}${logorreaHint}
**Se il tuo ultimo messaggio è una domanda, non considerare questa nella valutazione.**
**Valuta la presenza della problematica "${selectedProblem.fenomeno}" all'interno delle risposte del paziente, usando il seguente modello:**
**Modello di output:**
${selectedProblem.modello_di_output}
${previousScore >= 0
  ? `\nNOTA: Il punteggio valutato precedentemente per questo fenomeno era: '${previousScore}' (su una scala da 0 a 4). Se il nuovo punteggio risulta significativamente diverso, segnalare un possibile cambiamento nella gravità del problema.`
  : ''}
Conversazione completa:
${chat.map(msg => `${msg.role === 'user' ? 'PAZIENTE' : 'MEDICO'}: ${msg.message}`).join('\n')}
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const match = text.match(/Punteggio Assegnato:\s*([0-4])/i);

      if (match) {
        const newScore = parseInt(match[1]);
        setCurrentEvaluationScores(prev => ({
          ...prev,
          [selectedProblem.fenomeno]: newScore
        }));
      }

      setChat(prev => [...prev, { role: 'bot', message: `**${selectedProblem.fenomeno}**\n${text}` }]);
    } catch (err) {
      console.error('Errore durante la valutazione:', err);
      Alert.alert('Errore', 'Valutazione fallita.');
    } finally {
      setEvaluating(false);
    }
  }, [chat, chatHistory, currentChatId, avgTimeResponse]);

  const handleEvaluateProblems = useCallback(async () => {
    if (chat.length === 0) {
      Alert.alert('Attenzione', 'Non c\'è alcuna conversazione da valutare');
      return;
    }

    setEvaluating(true);

    try {
      const problemDetails = await JsonFileReader.getProblemDetails();

      if (avgTimeResponse !== undefined) {
        Alert.alert('⏱️ Info Generale', `Tempo medio di risposta: ${avgTimeResponse.toFixed(2)} secondi`);
      }

      const evaluations = [];

      for (const problem of problemDetails) {
        const isLogorrea = problem.fenomeno.toLowerCase().includes('logorrea');

        const timeHint = (problem.fenomeno.toLowerCase().includes('rallentato') && avgTimeResponse !== undefined)
          ? `**Nota:** Il paziente impiega in media **${avgTimeResponse.toFixed(2)} secondi** per rispondere alle domande del medico.\n\n`
          : '';

        const logorreaHint = isLogorrea && avgResponseLength !== undefined && counterInterruption !== undefined
          ? `\n**Nota da menzionare nella valutazione logorrea:** Il paziente ha una lunghezza media delle risposte pari a **${avgResponseLength.toFixed(2)} parole**. Inoltre, interrompe il medico in **${(counterInterruption * 100).toFixed(1)}%** delle volte.\n\n`
          : '';

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

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        evaluations.push({
          problem: problem.fenomeno,
          evaluation: text || 'Nessuna valutazione disponibile.',
        });
      }

      const formatted = evaluations.map(e => `**${e.problem}**\n${e.evaluation}\n\n`).join('---\n');
      setChat(prev => [...prev, { role: 'bot', message: formatted }]);
    } catch (err) {
      console.error('Errore durante la valutazione:', err);
      Alert.alert('Errore', 'Errore nella generazione del report.');
    } finally {
      setEvaluating(false);
    }
  }, [chat, avgTimeResponse]);

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
