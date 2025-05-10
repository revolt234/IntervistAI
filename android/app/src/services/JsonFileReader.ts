import RNFS from 'react-native-fs'; // Importa react-native-fs
import { Platform } from 'react-native';

class JsonFileReader {
  static async getRandomMedicalQuestions(): Promise<string[]> {
    try {
      if (Platform.OS !== 'android') {
        throw new Error('Questa funzionalità è supportata solo su Android');
      }

      // Percorso relativo alla cartella assets
      const directoryPath = 'cartellaTrascrizioni';

      // 1. Ottieni la lista dei file nella cartella assets
      const files = await this.getAssetsList(directoryPath);

      if (files.length === 0) {
        throw new Error('Nessun file trovato nella cartella assets');
      }

      // 2. Filtra solo i file JSON
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      if (jsonFiles.length === 0) {
        throw new Error('Nessun file JSON trovato');
      }

      // 3. Seleziona un file casuale
      const randomFile = jsonFiles[Math.floor(Math.random() * jsonFiles.length)];
      const filePath = `${directoryPath}/${randomFile}`;

      // 4. Leggi il contenuto del file
      const fileContent = await this.readAssetFile(filePath);
      const jsonData = JSON.parse(fileContent);

      // 5. Estrai le domande mediche
      if (jsonData && Array.isArray(jsonData.transcription)) {
        const medicalQuestions = jsonData.transcription
          .filter(entry => entry?.role === 'medico' && entry.text)
          .map((entry, index) => `${index + 1}. ${entry.text}\n`);

        return medicalQuestions.join('\n');

      }

      throw new Error('Formato JSON non valido');
    } catch (error) {
      console.error('Errore nella lettura del file JSON:', error);
      throw error;
    }
  }

  // Metodo per leggere i file nella cartella assets (Android)
  private static async getAssetsList(path: string): Promise<string[]> {
    try {
      // Legge il contenuto della cartella assets
      const files = await RNFS.readDirAssets(path);

      // Estrae solo i nomi dei file dai risultati
      return files.map(file => file.name); // Restituisce solo i nomi dei file
    } catch (error) {
      throw new Error(`Errore nel recupero della lista dei file: ${error.message}`);
    }
  }

  // Metodo per leggere il contenuto di un file in assets (Android)
  private static async readAssetFile(path: string): Promise<string> {
    try {
      const fileContent = await RNFS.readFileAssets(path, 'utf8');
      return fileContent;
    } catch (error) {
      throw new Error(`Errore nella lettura del file ${path}: ${error.message}`);
    }
  }

  // Funzione per leggere il file tald.json e restituire i dettagli dei problemi
    static async getProblemDetails(): Promise<any[]> {
       try {
         // Verifica se la piattaforma è Android (per compatibilità con assets)
         if (Platform.OS !== 'android') {
           throw new Error('Questa funzionalità è supportata solo su Android');
         }

         // Percorso relativo alla cartella contenente i file (cartellaTALD)
         const directoryPath = 'cartellaTALD'; // Modifica il percorso come necessario

         // 1. Ottieni la lista dei file nella cartella
         const files = await RNFS.readDirAssets(directoryPath);

         // 2. Verifica se i file sono presenti
         if (files.length === 0) {
           throw new Error('Nessun file trovato nella cartella assets');
         }

         // 3. Cerca il file JSON "jsonTald.json"
         const jsonFile = files.find(file => file.name === 'jsonTald.json');
         if (!jsonFile) {
           throw new Error('File jsonTald.json non trovato nella cartella assets');
         }

         // 4. Leggi il contenuto del file JSON
         const filePath = `${directoryPath}/${jsonFile.name}`;
         const fileData = await RNFS.readFileAssets(filePath, 'utf8');

         // 5. Verifica che i dati del file siano validi
         let jsonData;
         try {
           jsonData = JSON.parse(fileData);
         } catch (parseError) {
           throw new Error('Errore nel parsing del file JSON: ' + parseError.message);
         }

         // 6. Controlla la struttura del JSON
         if (!jsonData.transcription || !Array.isArray(jsonData.transcription)) {
           throw new Error('Il formato del file JSON è errato. La proprietà "transcription" non è presente o non è un array.');
         }

         // 7. Restituisci i dati della transcrizione
         return jsonData.transcription;

       } catch (error) {
         console.error('Errore nel caricamento del file JSON:', error);
         throw error;
       }
     }
}

export default JsonFileReader;
