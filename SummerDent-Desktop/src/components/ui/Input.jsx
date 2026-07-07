export default function Input({ label, error, ...props }) {
  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      <input className={error ? 'input-error' : ''} {...props} />
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
