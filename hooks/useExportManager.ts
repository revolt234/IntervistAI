import { useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import RNFS from 'react-native-fs';

// 1. Aggiorniamo l'interfaccia per includere i timestamp
interface Message {
  role: 'user' | 'bot';
  message: string;
  start: number;
  end: number;
}

export const useExportManager = () => {
  const [exporting, setExporting] = useState(false);

  const requestStoragePermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    // La logica per i permessi rimane invariata
    try {
      if (Platform.Version >= 33) return true;

      const write = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
      );
      const read = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      );
      return write === PermissionsAndroid.RESULTS.GRANTED &&
             read === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('Errore richiesta permessi:', err);
      return false;
    }
  };

  // 2. La funzione ora si chiama exportChatToJson e gestisce la nuova logica
  const exportChatToJson = async (chat: Message[], fileName: string) => {
    setExporting(true);

    try {
      // Assicura che il file finisca con .json
      if (!fileName.endsWith('.json')) {
        fileName += '.json';
      }

      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert('Permesso negato', 'Concedi i permessi di archiviazione per esportare.');
        return;
      }

      // 3. Mappiamo la chat nel formato di trascrizione desiderato
      const transcription = chat.map(msg => {
        // Ignora i messaggi "nascosti" usati internamente
        if (msg.message === 'INIZIO_INTERVISTA_NASCOSTO') {
          return null;
        }

        return {
          speaker: msg.role === 'bot' ? 'SPEAKER_00' : 'SPEAKER_01',
          role: msg.role === 'bot' ? 'medico' : 'paziente',
          start: msg.start,
          end: msg.end,
          text: msg.message,
        };
      }).filter(Boolean); // Rimuove eventuali elementi nulli

      // 4. Creiamo l'oggetto finale con la chiave "transcription"
      const contentObject = {
        transcription: transcription,
      };

      // 5. Convertiamo l'oggetto in una stringa JSON ben formattata (pretty-print)
      const jsonContent = JSON.stringify(contentObject, null, 2);

      const path = `${RNFS.DownloadDirectoryPath}/${fileName}`;
      await RNFS.writeFile(path, jsonContent, 'utf8');

      if (Platform.OS === 'android') {
        await RNFS.scanFile(path);
      }

      Alert.alert('File JSON salvato', `Salvato come: ${fileName}`);
    } catch (err) {
      console.error('Errore esportazione JSON:', err);
      Alert.alert('Errore', 'Impossibile salvare il file JSON.');
    } finally {
      setExporting(false);
    }
  };

  return {
    exporting,
    exportChatToFile: exportChatToJson, // Esportiamo la nuova funzione con il vecchio nome per compatibilità
  };
};
