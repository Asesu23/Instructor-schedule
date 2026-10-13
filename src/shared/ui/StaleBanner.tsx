export function StaleBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <p className="notice">Данные могли устареть</p>;
}
