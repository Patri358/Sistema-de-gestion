import { IconChart } from './Icons.jsx';
import { formatARS } from '../utils.js';

const TITULOS = {
  dia: 'Ventas por hora',
  mes: 'Ventas por día',
  anio: 'Ventas por mes',
};

export default function GraficoVentas({ series = [], periodo = 'dia', etiqueta, cargando }) {
  const maximo = Math.max(...series.map((punto) => punto.total), 0);
  const total = series.reduce((suma, punto) => suma + punto.total, 0);
  const unidades = series.reduce((suma, punto) => suma + punto.unidades, 0);
  const hayDatos = series.some((punto) => punto.ventas > 0);

  return (
    <section className="card chart-card">
      <div className="chart-head">
        <div>
          <h2>
            <IconChart size={18} /> {TITULOS[periodo] ?? 'Ventas del período'}
          </h2>
          <p>Total facturado {etiqueta}</p>
        </div>
        {!cargando && hayDatos && (
          <span className="count-pill">
            {formatARS(total)} · {unidades} u.
          </span>
        )}
      </div>

      {cargando ? (
        <div className="time-chart-skeleton" />
      ) : !hayDatos ? (
        <div className="empty-state inline chart-empty">
          <span className="empty-icon">
            <IconChart size={26} />
          </span>
          <h3>Sin ventas en este período</h3>
          <p>Cuando registres ventas, acá vas a ver cómo se distribuyeron.</p>
        </div>
      ) : (
        <div className="time-chart">
          <div className="time-bars" style={{ minWidth: `${series.length * 34}px` }}>
            {series.map((punto) => {
              const alto =
                punto.total > 0 && maximo > 0 ? Math.max(3, (punto.total / maximo) * 100) : 0;
              return (
                <div
                  className={`time-bar ${punto.total > 0 ? 'con-ventas' : ''}`}
                  key={punto.etiqueta}
                  title={`${punto.etiqueta}: ${formatARS(punto.total)} · ${punto.ventas} ventas`}
                >
                  {series.length <= 16 && (
                    <span className="time-bar-value">
                      {punto.total > 0 ? formatARS(punto.total) : ''}
                    </span>
                  )}
                  <div className="time-bar-track">
                    <div className="time-bar-fill" style={{ height: `${alto}%` }} />
                  </div>
                  <span className="time-bar-label">{punto.etiqueta}</span>
                  <span className="time-bar-count">{punto.ventas > 0 ? punto.ventas : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
