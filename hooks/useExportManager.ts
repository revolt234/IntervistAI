import { useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import RNFS from 'react-native-fs';

interface Message {
  role: 'user' | 'bot';
  message: string;
}

export const useExportManager = () => {
  const [exporting, setExporting] = useState(false);

  const requestStoragePermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      if (Platform.Version >= 33) return true;

      const write = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Permesso di scrittura',
          message: 'L\'app ha bisogno del permesso per salvare i file',
          buttonPositive: 'Accetta',
          buttonNegative: 'Rifiuta',
        }
      );

      const read = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Permesso di lettura',
          message: 'L\'app ha bisogno del permesso per accedere ai file',
          buttonPositive: 'Accetta',
          buttonNegative: 'Rifiuta',
        }
      );

      return write === PermissionsAndroid.RESULTS.GRANTED &&
             read === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('Errore richiesta permessi:', err);
      return false;
    }
  };

  // ✅ Funzione per andare a capo ogni 6 parole
  const splitTextIntoLines = (text: string, wordsPerLine: number = 6): string => {
    const words = text.split(/\s+/);
    const lines: string[] = [];

    for (let i = 0; i < words.length; i += wordsPerLine) {
      lines.push(words.slice(i, i + wordsPerLine).join(' '));
    }

    return lines.join('\n');
  };

  const exportChatToFile = async (chat: Message[], fileName: string) => {
    setExporting(true);

    try {
      if (!fileName.endsWith('.txt')) {
        fileName += '.txt';
      }

      const hasPermission = await requestStoragePermission();
      if (!hasPermission) {
        Alert.alert('Permesso negato', 'Concedi i permessi di archiviazione per esportare.');
        return;
      }

      let content = 'Conversazione Medico-Paziente\n\n';
      content += `Data: ${new Date().toLocaleDateString()}\n\n`;

      chat.forEach(msg => {
        const role = msg.role === 'user' ? 'PAZIENTE' : 'MEDICO';
        const formattedMessage = splitTextIntoLines(msg.message, 6); // 👈 formato ogni 6 parole
        content += `${role}:\n${formattedMessage}\n\n`;
      });

      const path = `${RNFS.DownloadDirectoryPath}/${fileName}`;
      await RNFS.writeFile(path, content, 'utf8');

      if (Platform.OS === 'android') {
        await RNFS.scanFile(path);
      }

      Alert.alert('File salvato con successo', `Salvato come: ${fileName}`);
    } catch (err) {
      console.error('Errore esportazione:', err);
      Alert.alert('Errore', 'Impossibile salvare il file.');
    } finally {
      setExporting(false);
    }
  };

  return {
    exporting,
    exportChatToFile,
  };
};
