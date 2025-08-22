// File: JsonFileReader.ts

import { Platform, Alert } from 'react-native';
import RNFS from 'react-native-fs';
import { pick } from '@react-native-documents/picker';
import TranscriptAnalytics from './TranscriptAnalytics';

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

  static async importTranscriptFromFile(): Promise<{
    transcript: any[],
    avgTimeResponse: number,
    avgResponseLength: number,
    counterInterruption: number,
    avgSpeechRate: number,
    maxSpeechRate: number
  } | null> {
    try {
      if (Platform.OS !== 'android') {
        Alert.alert('Solo Android', 'Questa funzione è disponibile solo su Android.');
        return null;
      }

      const [file] = await pick({ type: 'application/json' });
      if (!file) return null;

      // 1. Leggiamo il file normalmente in UTF-8
      const content = await RNFS.readFile(file.uri, 'utf8');

      // 2. Facciamo il parse del contenuto
      const parsed = JSON.parse(content);

      // 3. Manteniamo la logica flessibile per i due formati JSON
      let transcript = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.transcription)
          ? parsed.transcription
          : null;

      if (!transcript) {
        Alert.alert('Errore', 'Formato del file JSON non valido. Deve essere un array o un oggetto con una chiave "transcription".');
        return null;
      }

      // 4. Calcoliamo le metriche
      const cleanTranscript = transcript.filter(turn => turn.text && turn.text.trim() !== '');
      const metrics = TranscriptAnalytics.calculateAllMetrics(cleanTranscript);

      return {
        transcript: cleanTranscript,
        ...metrics
      };

    } catch (error) {
      // 5. La gestione errori ora catturerà sia errori di lettura che di parsing (es. file non JSON)
      console.error('Errore durante l\'importazione:', error);
      Alert.alert('Errore', `Impossibile importare il file selezionato.\n Dettagli: ${error.message}`);
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

  // --- Funzioni private helper ---
  private static async readAssetFile(path: string): Promise<string> {
    return await RNFS.readFileAssets(path, 'utf8');
  }

  private static async getAssetsList(path: string): Promise<string[]> {
    const files = await RNFS.readDirAssets(path);
    return files.map(file => file.name);
  }
}

export default JsonFileReader;