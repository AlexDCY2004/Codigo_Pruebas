export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  isBlock = false,
  disabled = false,
  onClick
}) {
  const className = [
    'ui-btn',
    `ui-btn--${variant}`,
    isBlock ? 'ui-btn--block' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={className} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
