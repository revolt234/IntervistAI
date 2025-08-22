// components/ChartsReport.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Svg,
  G,
  Line as SvgLine,
  Circle,
  Text as SvgText,
  Path,
  Rect,
} from 'react-native-svg';

type ChartsReportProps = {
  problems: Array<{ fenomeno: string; descrizione?: string }>;
  evaluationLog?: {
    [fenomeno: string]: Array<{ score: number; timestamp: number }>;
  };
};

const CHART_WIDTH = 320;
const CHART_HEIGHT = 200;
const MARGIN = { top: 16, right: 24, bottom: 32, left: 24 };
const PLOT_W = CHART_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

function toNiceDateLabel(d: Date) {
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dd}/${mm}`;
}

function buildPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return '';
  const [first, ...rest] = points;
  const cmds = [`M ${first.x} ${first.y}`, ...rest.map(p => `L ${p.x} ${p.y}`)];
  return cmds.join(' ');
}

const ChartsReport: React.FC<ChartsReportProps> = ({ problems, evaluationLog }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Andamento valutazioni per fenomeno</Text>

      {problems.map((p) => {
        const series = (evaluationLog?.[p.fenomeno] ?? [])
          .slice()
          .sort((a, b) => a.timestamp - b.timestamp);

        // ✅ CORREZIONE: Calcolo diretto dei valori min/max senza usare l'hook useMemo
        let xMin, xMax;
        if (series.length === 0) {
          const now = Date.now();
          xMin = now - 86400000; // 1 giorno fa
          xMax = now;
        } else {
          xMin = series[0].timestamp;
          // Assicura che xMax sia sempre maggiore di xMin se c'è un solo punto
          xMax = series.length > 1 ? series[series.length - 1].timestamp : series[0].timestamp + 1;
        }

        const yMin = 0;
        const yMax = 4;

        const xScale = (t: number) => {
          if (xMax === xMin) return MARGIN.left + PLOT_W / 2;
          return MARGIN.left + ((t - xMin) / (xMax - xMin)) * PLOT_W;
        };
        const yScale = (y: number) => {
          return MARGIN.top + PLOT_H - ((y - yMin) / (yMax - yMin)) * PLOT_H;
        };

        const points = series.map(s => ({
          x: xScale(s.timestamp),
          y: yScale(s.score),
        }));

        const pathD = buildPath(points);
        const yTicks = [0, 1, 2, 3, 4];

        const xTickCount = Math.min(4, Math.max(2, series.length));
        const xTickIdx = Array.from({ length: xTickCount }, (_, i) =>
          Math.floor((i / (xTickCount - 1)) * (series.length - 1))
        );
        const xTicks =
          series.length > 0
            ? Array.from(new Set(xTickIdx)).map((idx) => {
                const d = new Date(series[idx].timestamp);
                return { x: xScale(series[idx].timestamp), label: toNiceDateLabel(d) };
              })
            : [];

        const last = series[series.length - 1];
        const prev = series[series.length - 2];

        return (
          <View key={p.fenomeno} style={styles.card}>
            <Text style={styles.fenomeno}>{p.fenomeno}</Text>
            <Text style={styles.desc}>
              {series.length ? `Valutazioni: ${series.length} (0–4)` : 'Nessuna valutazione registrata'}
            </Text>

            <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={{ alignSelf: 'center' }}>
              <Rect x={MARGIN.left} y={MARGIN.top} width={PLOT_W} height={PLOT_H} fill="#ffffff" />
              <G>
                <SvgLine x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + PLOT_H} stroke="#333" strokeWidth={1} />
                {yTicks.map((t) => {
                  const y = yScale(t);
                  return (
                    <G key={`y-${t}`}>
                      <SvgLine x1={MARGIN.left} y1={y} x2={MARGIN.left + PLOT_W} y2={y} stroke="#eee" strokeWidth={1} />
                      <SvgText x={MARGIN.left - 6} y={y + 4} fontSize="10" fill="#333" textAnchor="end">
                        {t}
                      </SvgText>
                    </G>
                  );
                })}
              </G>
              <SvgLine x1={MARGIN.left} y1={MARGIN.top + PLOT_H} x2={MARGIN.left + PLOT_W} y2={MARGIN.top + PLOT_H} stroke="#333" strokeWidth={1} />
              {xTicks.map((tick, i) => (
                <G key={`x-${i}`}>
                  <SvgLine x1={tick.x} y1={MARGIN.top + PLOT_H} x2={tick.x} y2={MARGIN.top + PLOT_H + 4} stroke="#333" strokeWidth={1} />
                  <SvgText x={tick.x} y={MARGIN.top + PLOT_H + 16} fontSize="10" fill="#333" textAnchor="middle">
                    {tick.label}
                  </SvgText>
                </G>
              ))}
              <Path d={pathD} stroke="#1976D2" strokeWidth={2} fill="none" />
              {points.map((pt, idx) => (
                <Circle key={`pt-${idx}`} cx={pt.x} cy={pt.y} r={3} fill="#1976D2" />
              ))}
              {points.length === 0 && (
                <SvgText x={MARGIN.left + PLOT_W / 2} y={MARGIN.top + PLOT_H / 2} fontSize="12" fill="#999" textAnchor="middle">
                  Nessun dato
                </SvgText>
              )}
            </Svg>
            {series.length >= 2 && last && prev && (
              <Text style={styles.delta}>
                Ultimo: {last.score} • Precedente: {prev.score} • Δ {last.score - prev.score}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: '#fff' },
  title: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 10,
    color: '#000', // ✅ Aggiunto per rendere il titolo nero
  },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  fenomeno: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#000', // ✅ Aggiunto per rendere il titolo del grafico nero
  },
  desc: { color: '#666', marginBottom: 6 },
  delta: { marginTop: 6, fontStyle: 'italic', color: '#333' },
});

export default ChartsReport;