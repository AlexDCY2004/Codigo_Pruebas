export default function Button({ variant = 'primary', children, disabled, onClick, block, className = '', ...props }) {
  const base = 'btn';
  const variantClass = variant === 'secondary' ? 'btn-secondary' : 'btn-primary';
  const blockClass = block ? 'btn-block' : '';
  return (
    <button className={`${base} ${variantClass} ${blockClass} ${className}`.trim()} disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  );
}
