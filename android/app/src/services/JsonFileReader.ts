// File: JsonFileReader.ts

import { Platform, Alert } from 'react-native';
import RNFS from 'react-native-fs';
import { pick } from '@react-native-documents/picker';

class JsonFileReader {
  static async getRandomMedicalQuestions(): Promise<string[]> {
    try {
      if (Platform.OS !== 'android') throw new Error('Funziona solo su Android');

      const directoryPath = 'cartellaTrascrizioni';
      const files = await this.getAssetsList(directoryPath);
      if (files.length === 0) throw new Error('Nessun file trovato');

      const jsonFiles = files.filter(file => file.endsWith('.json'));
      if (jsonFiles.length === 0) throw new Error('Nessun file JSON trovato');

      const randomFile = jsonFiles[Math.floor(Math.random() * jsonFiles.length)];
      const filePath = `${directoryPath}/${randomFile}`;
      const fileContent = await this.readAssetFile(filePath);
      const jsonData = JSON.parse(fileContent);

      if (jsonData && Array.isArray(jsonData.transcription)) {
        return jsonData.transcription
          .filter(entry => entry?.role === 'medico' && entry.text)
          .map((entry, index) => `${index + 1}. ${entry.text}`);
      }

      throw new Error('Formato JSON non valido');
    } catch (error) {
      console.error('Errore getRandomMedicalQuestions:', error);
      throw error;
    }
  }

  // ✅ AGGIORNATA: restituisce anche avgResponseLength e counterInterruption
  static async importTranscriptFromFile(): Promise<{
      transcript: any[],
      avgTimeResponse: number,
      avgResponseLength: number,
      counterInterruption: number
    } | null> {
      try {
        if (Platform.OS !== 'android') {
          Alert.alert('Solo Android', 'Questa funzione è disponibile solo su Android.');
          return null;
        }

        const [file] = await pick({ type: 'application/json' });
        if (!file) return null;

        const content = await RNFS.readFile(file.uri, 'utf8');
        const parsed = JSON.parse(content);

        let transcript = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.transcription)
            ? parsed.transcription
            : null;

        if (!transcript) {
          Alert.alert('Errore', 'Formato del file JSON non valido.');
          return null;
        }

        // --- 👇 MODIFICA CHIAVE: Filtra i turni con testo vuoto o solo spazi ---
        transcript = transcript.filter(turn => turn.text && turn.text.trim() !== '');
        // --- 👆 FINE MODIFICA ---

        // ⏱ Calcolo media tempi risposta (ora su dati puliti)
        const delays: number[] = [];
        let lastMedicoEnd: number | null = null;

        for (const turn of transcript) {
          if (turn.role === 'medico') {
            lastMedicoEnd = turn.end;
          } else if (turn.role === 'paziente' && lastMedicoEnd !== null) {
            const delay = turn.start - lastMedicoEnd;
            if (delay > 0) delays.push(delay);
            lastMedicoEnd = null;
          }
        }

        const avgTime = delays.length > 0
          ? delays.reduce((a, b) => a + b, 0) / delays.length
          : 0;

        // 🗣️ Calcolo avgResponseLength (ora su dati puliti)
        const patientTurns = transcript.filter(t => t.role === 'paziente');
        const wordCounts = patientTurns.map(t => t.text.trim().split(/\s+/).length);
        const avgLength = wordCounts.length > 0
          ? wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
          : 0;

        // 🚨 Calcolo counterInterruption (ora su dati puliti)
        const interruptions = transcript.reduce((count, curr, idx) => {
            // Si applica solo ai turni del paziente e non al primo turno in assoluto
            if (idx === 0 || curr.role !== 'paziente') {
                return count;
            }

            const prevTurn = transcript[idx - 1]; // Prende solo il turno immediatamente precedente

            // Controlla se il turno precedente era del medico e se c'è sovrapposizione
            if (prevTurn.role === 'medico' && curr.start < prevTurn.end) {
                return count + 1;
            }

            return count;
        }, 0);

        const totalMedicoTurns = transcript.filter(t => t.role === 'medico').length;
        const interruptionRatio = totalMedicoTurns > 0
          ? interruptions / totalMedicoTurns
          : 0;

        return {
          transcript, // Restituisce la trascrizione già filtrata
          avgTimeResponse: parseFloat(avgTime.toFixed(2)),
          avgResponseLength: parseFloat(avgLength.toFixed(2)),
          counterInterruption: parseFloat(interruptionRatio.toFixed(2)),
        };

      } catch (error) {
        console.error('Errore durante l\'importazione:', error);
        Alert.alert('Errore', 'Impossibile importare il file selezionato.');
        return null;
      }
    }

  static async getProblemDetails(): Promise<any[]> {
    try {
      if (Platform.OS !== 'android') throw new Error('Funziona solo su Android');

      const directoryPath = 'cartellaTALD';
      const files = await RNFS.readDirAssets(directoryPath);
      if (files.length === 0) throw new Error('Nessun file trovato');

      const jsonFile = files.find(file => file.name === 'jsonTald.json');
      if (!jsonFile) throw new Error('jsonTald.json non trovato');

      const filePath = `${directoryPath}/${jsonFile.name}`;
      const content = await RNFS.readFileAssets(filePath, 'utf8');
      const jsonData = JSON.parse(content);

      if (!jsonData.transcription || !Array.isArray(jsonData.transcription)) {
        throw new Error('Formato JSON errato');
      }

      return jsonData.transcription;
    } catch (error) {
      console.error('Errore getProblemDetails:', error);
      throw error;
    }
  }

  // 🔧 Private helper
  private static async readAssetFile(path: string): Promise<string> {
    return await RNFS.readFileAssets(path, 'utf8');
  }

  private static async getAssetsList(path: string): Promise<string[]> {
    const files = await RNFS.readDirAssets(path);
    return files.map(file => file.name);
  }
}

export default JsonFileReader;
