import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function GraficoLineas({ series = [], periodo, etiqueta, cargando }) {
  const datos = {
    labels: series.map((punto) => punto.etiqueta),
    datasets: [
      {
        label: 'Facturación',
        data: series.map((punto) => punto.total),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.16)',
        pointBackgroundColor: '#2563eb',
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const opciones = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: (contexto) => {
            const punto = series[contexto.dataIndex];
            return `${punto.ventas} ventas · ${punto.unidades} unidades`;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
      y: { beginAtZero: true, ticks: { precision: 0 } },
    },
  };

  if (cargando) return <div className="chart-empty">Cargando gráfico...</div>;
  if (!series.length) return <div className="chart-empty">Sin datos para el período.</div>;

  return (
    <div className="estadistica-chart" id="stats-picos">
      <Line data={datos} options={opciones} aria-label={`Picos de ventas: ${etiqueta}`} />
    </div>
  );
}
