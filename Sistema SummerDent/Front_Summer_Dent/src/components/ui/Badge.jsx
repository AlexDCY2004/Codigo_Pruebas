const badgeVariantMap = {
  ok: 'ui-badge--ok',
  info: 'ui-badge--info',
  warning: 'ui-badge--warning',
  neutral: 'ui-badge--neutral'
};

export default function Badge({ children, variant = 'neutral' }) {
  const variantClass = badgeVariantMap[variant] || badgeVariantMap.neutral;
  return <span className={`ui-badge ${variantClass}`}>{children}</span>;
}
