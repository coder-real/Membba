const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

export default function Button({ as: Tag = 'button', variant = 'secondary', className = '', children, ...props }) {
  return (
    <Tag className={`${variants[variant] || variants.secondary} ${className}`} {...props}>
      {children}
    </Tag>
  )
}
