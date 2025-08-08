// components/ChartsReportExport.tsx
import React, { useRef, useState } from 'react';
import {
  View,
  Button,
  Alert,
  Platform,
  PermissionsAndroid,
  StyleSheet,
  InteractionManager,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import ChartsReport from './ChartsReport';

type EvaluationLog = {
  [fenomeno: string]: Array<{ score: number; timestamp: number }>;
};

type Props = {
  problems: any[];
  evaluationLog?: EvaluationLog;
  onSaved?: (fullPath: string) => void;
};

async function ensureStoragePermissionIfNeeded(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const sdk = Number(Platform.Version) || 0;
  if (sdk >= 33) return true; // WRITE_EXTERNAL_STORAGE è deprecato su 33+

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

const ChartsReportExport: React.FC<Props> = ({
  problems,
  evaluationLog,
  onSaved,
}) => {
  // ✅ ref diretto a ViewShot (NON a View)
  const shotRef = useRef<ViewShot>(null);
  const [isLaidOut, setIsLaidOut] = useState(false);
  const [layoutSize, setLayoutSize] = useState<{w: number; h: number}>({ w: 0, h: 0 });

  const handleExport = async () => {
    try {
      if (!shotRef.current) {
        Alert.alert('Attenzione', 'Vista non pronta (ref mancante).');
        return;
      }
      if (!isLaidOut || layoutSize.w === 0 || layoutSize.h === 0) {
        Alert.alert('Attenzione', 'La vista non è ancora stata renderizzata. Riprova tra un secondo.');
        return;
      }

      // Evita di catturare durante animazioni/aggiornamenti
      await InteractionManager.runAfterInteractions();

      // ✅ usa il metodo .capture() del ViewShot
      const tmpUri = await shotRef.current.capture?.({
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      if (!tmpUri) {
        throw new Error('Nessun URI generato dalla cattura');
      }

      if (Platform.OS === 'android') {
        const ok = await ensureStoragePermissionIfNeeded();

        const fileName =
          'ReportGrafici_' +
          new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') +
          '.png';

        const destDownload = `${RNFS.DownloadDirectoryPath}/${fileName}`;

        try {
          if (!ok) {
            await Share.open({
              url: 'file://' + tmpUri,
              type: 'image/png',
              failOnCancel: false,
            });
            onSaved?.(tmpUri);
            return;
          }

          await RNFS.copyFile(tmpUri, destDownload);
          Alert.alert('Esportazione riuscita', `Salvato in Download:\n${fileName}`);
          onSaved?.(destDownload);
          return;
        } catch (err) {
          // Fallback: Pictures
          try {
            const destPictures = `${RNFS.PicturesDirectoryPath}/${fileName}`;
            await RNFS.copyFile(tmpUri, destPictures);
            Alert.alert('Esportazione riuscita', `Salvato in Immagini:\n${fileName}`);
            onSaved?.(destPictures);
            return;
          } catch {
            // Ultimo fallback: share
            await Share.open({
              url: 'file://' + tmpUri,
              type: 'image/png',
              failOnCancel: false,
            });
            onSaved?.(tmpUri);
            return;
          }
        }
      } else {
        await Share.open({
          url: 'file://' + tmpUri,
          type: 'image/png',
          failOnCancel: false,
        });
        onSaved?.(tmpUri);
      }
    } catch (e: any) {
      console.error('Export error:', e);
      Alert.alert(
        'Errore',
        `Impossibile esportare l’immagine dei grafici.\n${e?.message ?? ''}`
      );
    }
  };

  return (
    <>
      {/* wrapper con sfondo per evitare trasparenze nello screenshot */}
      <View style={styles.wrapper}>
        {/* ✅ ViewShot con ref diretto, collapsable e captureMode */}
       <ViewShot
         ref={shotRef}
         style={styles.shot}
         // captureMode="manual"  <-- RIMOSSO per evitare il warning
         onLayout={(e) => {
           const { width, height } = e.nativeEvent.layout;
           setLayoutSize({ w: width, h: height });
           setIsLaidOut(true);
         }}
         options={{ format: 'png', quality: 1 }}
       >
         <View collapsable={false} style={styles.content}>
           <ChartsReport problems={problems} evaluationLog={evaluationLog} />
         </View>
       </ViewShot>


      </View>

      <View style={styles.actions}>
        <Button title="Esporta immagine grafici" onPress={handleExport} />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff',
  },
  shot: {
    backgroundColor: '#fff',
    // Dare dimensioni non-zero aiuta ViewShot su Android
    // Se il contenuto è grande, almeno assicurati che prenda spazio:
    // (se vuoi fisso, imposta width esplicita)
    // width: 360,
  },
  content: {
    padding: 16,
    backgroundColor: '#fff',
  },
  actions: {
    padding: 10,
  },
});

export default ChartsReportExport;
