export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <p className="error" onClick={onDismiss}>
      {message}
    </p>
  );
}
