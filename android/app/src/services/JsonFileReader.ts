import { Platform, Alert } from 'react-native';
import RNFS from 'react-native-fs';

class JsonFileReader {
  // ✅ 1. Estrae domande mediche da un file JSON casuale dagli asset
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

  // ✅ 2. Importa un file JSON dal file system (senza permessi)
   static async importTranscriptFromFile(): Promise<any[] | null> {
       try {
         if (Platform.OS !== 'android') {
           Alert.alert('Solo Android', 'Questa funzione è disponibile solo su Android.');
           return null;
         }

         // 1. Trova tutti i file JSON nella directory
         const directoryPath = RNFS.DownloadDirectoryPath;
         const files = await RNFS.readDir(directoryPath);

         const jsonFiles = files.filter(file =>
           file.name.toLowerCase().endsWith('.json') &&
           file.isFile()
         );

         if (jsonFiles.length === 0) {
           Alert.alert('Nessun file', 'Non sono stati trovati file JSON nella directory Download.');
           return null;
         }

         // 2. Mostra un Alert con la selezione
         const selectedFile = await new Promise<RNFS.ReadDirItem | null>((resolve) => {
           const buttons = jsonFiles.map(file => ({
             text: file.name,
             onPress: () => resolve(file)
           }));

           buttons.push({
             text: 'Annulla',
             onPress: () => resolve(null),
             style: 'cancel'
           });

           Alert.alert(
             'Seleziona un file JSON',
             'Scegli il file da importare:',
             buttons
           );
         });

         if (!selectedFile) return null;

         // 3. Leggi il file selezionato
         const content = await RNFS.readFile(selectedFile.path, 'utf8');
         const parsed = JSON.parse(content);

         if (!parsed.transcription || !Array.isArray(parsed.transcription)) {
           Alert.alert('Errore', 'Il file non contiene dati validi.');
           return null;
         }

         return parsed.transcription;
       } catch (error) {
         console.error('Errore durante import:', error);
         Alert.alert('Errore', 'Impossibile importare il file selezionato.');
         return null;
       }
     }

  // ✅ 3. Estrae problemi da jsonTald.json negli asset
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

  // 🔧 Legge file asset Android
  private static async readAssetFile(path: string): Promise<string> {
    return await RNFS.readFileAssets(path, 'utf8');
  }

  // 🔧 Ottiene elenco dei file da una cartella asset
  private static async getAssetsList(path: string): Promise<string[]> {
    const files = await RNFS.readDirAssets(path);
    return files.map(file => file.name);
  }
}

export default JsonFileReader;
