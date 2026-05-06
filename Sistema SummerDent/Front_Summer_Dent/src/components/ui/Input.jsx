export default function Input({
  id,
  name,
  type = 'text',
  label,
  value,
  onChange,
  placeholder,
  required = false,
  autoComplete,
  error
}) {
  return (
    <div className="ui-field">
      {label ? (
        <label htmlFor={id} className="ui-field__label">
          {label}
        </label>
      ) : null}

      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className={error ? 'ui-input ui-input--error' : 'ui-input'}
      />

      {error ? <p className="ui-field__error">{error}</p> : null}
    </div>
  );
}
