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

  // ✅ AGGIORNATA: restituisce anche avgResponseLength e counterInterruption

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

     // 1. Filtra i turni vuoti
     const cleanTranscript = transcript.filter(turn => turn.text && turn.text.trim() !== '');

     // 2. Calcola tutte le metriche con una sola chiamata!
     const metrics = TranscriptAnalytics.calculateAllMetrics(cleanTranscript);

     // 3. Restituisci la trascrizione pulita e le metriche calcolate
     return {
       transcript: cleanTranscript,
       ...metrics
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
