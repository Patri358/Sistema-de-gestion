import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORES = [
  '#2563eb',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#64748b',
];

export default function GraficoTorta({ mediosPago = [], cargando }) {
  const datos = {
    labels: mediosPago.map((medio) => medio.etiqueta),
    datasets: [
      {
        data: mediosPago.map((medio) => medio.total),
        backgroundColor: mediosPago.map((_, indice) => COLORES[indice % COLORES.length]),
        borderColor: 'transparent',
        hoverOffset: 6,
      },
    ],
  };

  const opciones = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true } },
      tooltip: {
        callbacks: {
          afterLabel: (contexto) => `${mediosPago[contexto.dataIndex].cantidad} ventas`,
        },
      },
    },
  };

  if (cargando) return <div className="chart-empty">Cargando gráfico...</div>;
  if (!mediosPago.length) return <div className="chart-empty">Sin medios de pago en el período.</div>;

  return (
    <div className="estadistica-chart torta" id="stats-medios-pago">
      <Pie data={datos} options={opciones} aria-label="Medios de pago" />
    </div>
  );
}
