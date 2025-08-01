// File: JsonFileReader.ts (Versione finale e corretta)

import { Platform, Alert } from 'react-native';
import RNFS from 'react-native-fs';
// ✅ 1. Import 'pick' dalla NUOVA libreria corretta
import { pick } from '@react-native-documents/picker';

class JsonFileReader {
  // ℹ️ Questa funzione non è stata modificata
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

  // ✅ 2. Questa è la funzione CORRETTA e AGGIORNATA
  static async importTranscriptFromFile(): Promise<any[] | null> {
    try {
      if (Platform.OS !== 'android') {
        Alert.alert('Solo Android', 'Questa funzione è disponibile solo su Android.');
        return null;
      }

      // 2a. Usa 'pick' dalla nuova libreria e destruttura il risultato
      const [file] = await pick({
        type: 'application/json',
      });

      // 2b. Se l'utente annulla, 'file' sarà undefined, quindi usciamo
      if (!file) {
        console.log('User cancelled the file picker.');
        return null;
      }

      // 2c. Leggi il contenuto del file selezionato
      const content = await RNFS.readFile(file.uri, 'utf8');
      const parsed = JSON.parse(content);

      if (!parsed.transcription || !Array.isArray(parsed.transcription)) {
        Alert.alert('Errore', 'Il file non contiene dati di trascrizione validi.');
        return null;
      }

      return parsed.transcription;

    } catch (error) {
      // Non serve più 'DocumentPicker.isCancel', la gestione è più semplice
      console.error('Errore durante l\'importazione:', error);
      Alert.alert('Errore', 'Impossibile importare il file selezionato.');
      return null;
    }
  }

  // ℹ️ Questa funzione non è stata modificata
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

  // 🔧 Funzioni private (non modificate)
  private static async readAssetFile(path: string): Promise<string> {
    return await RNFS.readFileAssets(path, 'utf8');
  }

  private static async getAssetsList(path: string): Promise<string[]> {
    const files = await RNFS.readDirAssets(path);
    return files.map(file => file.name);
  }
}

export default JsonFileReader;