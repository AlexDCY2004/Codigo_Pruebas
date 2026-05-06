export default function EmptyState({ title = 'Sin datos', message = 'No hay informacion para mostrar.' }) {
  return (
    <div className="feedback feedback--empty">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}
