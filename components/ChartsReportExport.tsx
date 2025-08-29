import React, {
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  View,
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

// Il tipo per le funzioni che esponiamo con la ref rimane
export type ChartsReportExportHandles = {
  export: () => void;
};

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
  if (sdk >= 33) return true;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

const ChartsReportExport: React.ForwardRefRenderFunction<
  ChartsReportExportHandles,
  Props
> = ({ problems, evaluationLog, onSaved }, ref) => {
  const shotRef = useRef<ViewShot>(null);
  const [isLaidOut, setIsLaidOut] = useState(false);

  useImperativeHandle(ref, () => ({
    export: handleExport,
  }));

  const handleExport = async () => {
    try {
      if (!shotRef.current || !isLaidOut) {
        Alert.alert('Attenzione', 'La vista non è ancora stata renderizzata. Riprova tra un istante.');
        return;
      }
      await InteractionManager.runAfterInteractions();
      const tmpUri = await shotRef.current.capture?.({
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (!tmpUri) { throw new Error('Nessun URI generato dalla cattura'); }

      if (Platform.OS === 'android') {
        const ok = await ensureStoragePermissionIfNeeded();
        const fileName = `ReportGrafici_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
        const destDownload = `${RNFS.DownloadDirectoryPath}/${fileName}`;
        try {
          if (!ok) { throw new Error('Permesso negato'); }
          await RNFS.copyFile(tmpUri, destDownload);
          Alert.alert('Esportazione riuscita', `Salvato in Download:\n${fileName}`);
          onSaved?.(destDownload);
        } catch (err) {
            try {
                const destPictures = `${RNFS.PicturesDirectoryPath}/${fileName}`;
                await RNFS.copyFile(tmpUri, destPictures);
                Alert.alert('Esportazione riuscita', `Salvato in Immagini:\n${fileName}`);
                onSaved?.(destPictures);
            } catch {
                await Share.open({ url: 'file://' + tmpUri, type: 'image/png', failOnCancel: false });
                onSaved?.(tmpUri);
            }
        }
      } else {
        await Share.open({ url: 'file://' + tmpUri, type: 'image/png', failOnCancel: false });
        onSaved?.(tmpUri);
      }
    } catch (e: any) {
      console.error('Export error:', e);
      Alert.alert('Errore', `Impossibile esportare l’immagine dei grafici.\n${e?.message ?? ''}`);
    }
  };

  return (
    // Usiamo onLayout solo per sapere internamente se possiamo esportare
    <View style={styles.wrapper} onLayout={() => setIsLaidOut(true)}>
      <ViewShot ref={shotRef} style={styles.shot} options={{ format: 'png', quality: 1 }}>
        <View collapsable={false} style={styles.content}>
          <ChartsReport problems={problems} evaluationLog={evaluationLog} />
        </View>
      </ViewShot>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { backgroundColor: '#fff' },
  shot: { backgroundColor: '#fff' },
  content: { padding: 16, backgroundColor: '#fff' },
});

export default forwardRef(ChartsReportExport);