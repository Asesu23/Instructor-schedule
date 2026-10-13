import { useIsMutating } from '@tanstack/react-query';
import { dismissSyncFailure, useOnline, useSyncFailures } from '@/shared/lib';
import { ErrorBanner } from './ErrorBanner';

export function SyncStatus() {
  const online = useOnline();
  const queued = useIsMutating();

  if (online && queued === 0) return null;
  if (!online) {
    return (
      <p className="notice">
        {queued > 0 ? `Нет связи. Изменений в очереди: ${queued}` : 'Нет связи. Изменения отправятся позже'}
      </p>
    );
  }
  return <p className="notice">{`Отправка изменений: ${queued}`}</p>;
}

export function SyncFailures() {
  const failures = useSyncFailures();

  return (
    <>
      {failures.map((failure) => (
        <ErrorBanner key={failure.id} message={failure.message} onDismiss={() => dismissSyncFailure(failure.id)} />
      ))}
    </>
  );
}
