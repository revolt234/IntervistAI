// File: TranscriptAnalytics.ts

/**
 * Servizio per calcolare metriche quantitative da una trascrizione.
 */
class TranscriptAnalytics {
  // Definiamo una soglia massima realistica per il parlato (in parole al secondo).
  // Valori superiori sono quasi certamente errori di trascrizione.
  private static readonly MAX_REALISTIC_SPEECH_RATE = 8;

  /**
   * Metodo pubblico principale.
   * Calcola tutte le metriche disponibili da una data trascrizione.
   * @param transcript - L'array di turni della conversazione.
   * @returns Un oggetto contenente tutte le metriche calcolate.
   */
  public static calculateAllMetrics(transcript: any[]) {
    const patientTurns = transcript.filter(t => t.role === 'paziente');
    const totalMedicoTurns = transcript.filter(t => t.role === 'medico').length;

    const avgTimeResponse = this.calculateAvgTimeResponse(transcript);
    const avgResponseLength = this.calculateAvgResponseLength(patientTurns);
    const interruptionRatio = this.calculateInterruptionRatio(transcript, totalMedicoTurns);
    const { avg, max } = this.calculateSpeechRates(patientTurns);

    return {
      avgTimeResponse: parseFloat(avgTimeResponse.toFixed(2)),
      avgResponseLength: parseFloat(avgResponseLength.toFixed(2)),
      counterInterruption: parseFloat(interruptionRatio.toFixed(2)),
      avgSpeechRate: parseFloat(avg.toFixed(2)),
      maxSpeechRate: parseFloat(max.toFixed(2)),
    };
  }

  // --- Metodi privati per i singoli calcoli ---

  private static calculateAvgTimeResponse(transcript: any[]): number {
    const delays: number[] = [];
    let lastMedicoEnd: number | null = null;

    for (const turn of transcript) {
      if (turn.role === 'medico') {
        lastMedicoEnd = turn.end;
      } else if (turn.role === 'paziente' && lastMedicoEnd !== null) {
        const delay = turn.start - lastMedicoEnd;
        if (delay > 0) delays.push(delay);
        lastMedicoEnd = null; // Resetta dopo aver calcolato un ritardo
      }
    }
    return delays.length > 0
      ? delays.reduce((a, b) => a + b, 0) / delays.length
      : 0;
  }

  private static calculateAvgResponseLength(patientTurns: any[]): number {
    if (patientTurns.length === 0) return 0;

    const totalWords = patientTurns
      .map(t => t.text.trim().split(/\s+/).length)
      .reduce((a, b) => a + b, 0);

    return totalWords / patientTurns.length;
  }

  // ✅ METODO AGGIORNATO CON FILTRO PER VALORI ANOMALI
  private static calculateSpeechRates(patientTurns: any[]): { avg: number; max: number } {
    if (patientTurns.length === 0) return { avg: 0, max: 0 };

    const rates = patientTurns.map(turn => {
      const duration = turn.end - turn.start;
      if (duration <= 0) return 0;
      const words = turn.text.trim().split(/\s+/).length;
      return words / duration;
    }).filter(rate => rate > 0);

    // NUOVO: Filtriamo i valori anomali che superano la nostra soglia realistica
    const filteredRates = rates.filter(rate => rate <= this.MAX_REALISTIC_SPEECH_RATE);

    if (filteredRates.length === 0) return { avg: 0, max: 0 };

    // Usiamo l'array filtrato per i calcoli finali
    const avg = filteredRates.reduce((a, b) => a + b, 0) / filteredRates.length;
    const max = Math.max(...filteredRates);

    return { avg, max };
  }

  private static calculateInterruptionRatio(transcript: any[], totalMedicoTurns: number): number {
    if (totalMedicoTurns === 0) return 0;

    const interruptions = transcript.reduce((count, curr, idx) => {
      if (idx === 0 || curr.role !== 'paziente') {
        return count;
      }
      const prevTurn = transcript[idx - 1];
      if (prevTurn.role === 'medico' && curr.start < prevTurn.end) {
        return count + 1;
      }
      return count;
    }, 0);

    return interruptions / totalMedicoTurns;
  }
}

export default TranscriptAnalytics;