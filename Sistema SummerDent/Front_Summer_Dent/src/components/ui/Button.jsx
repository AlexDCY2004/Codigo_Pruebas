export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  isBlock = false,
  disabled = false,
  onClick,
  className: extraClass = '',
  ...rest
}) {
  const className = [
    'ui-btn',
    `ui-btn--${variant}`,
    isBlock ? 'ui-btn--block' : '',
    extraClass
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={className} disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}
