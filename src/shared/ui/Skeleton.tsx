export function Skeleton({ rows }: { rows: number }) {
  return (
    <ul className="list" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="skeleton" />
      ))}
    </ul>
  );
}
