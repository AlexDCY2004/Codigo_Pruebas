export default function ErrorState({
  title = 'Ocurrio un error',
  message = 'Intenta nuevamente en unos segundos.',
  onRetry
}) {
  return (
    <div className="feedback feedback--error">
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="ui-btn ui-btn--secondary" onClick={onRetry}>
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
