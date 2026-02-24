export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-12 w-12' : 'h-8 w-8';
  return (
    <div className={`${sizeClass} animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]`} />
  );
}
