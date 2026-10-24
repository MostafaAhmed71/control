const LOGO_SRC = '/school-logo.png';

export default function SchoolLogo({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
  };

  return (
    <img
      src={LOGO_SRC}
      alt="شعار المدرسة"
      className={`${sizes[size] || sizes.md} object-contain shrink-0 ${className}`}
    />
  );
}
