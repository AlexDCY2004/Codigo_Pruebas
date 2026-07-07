export default function ErrorState({ title = 'Ocurrió un error', message = 'Intenta nuevamente más tarde.', onRetry }) {
  return (
    <div className="error-state">
      <div className="error-state__icon">⚠️</div>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
