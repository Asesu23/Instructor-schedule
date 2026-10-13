import type { Student } from '../model/types';

export function StudentItem({ student, onSelect }: { student: Student; onSelect: (student: Student) => void }) {
  return (
    <li onClick={() => onSelect(student)}>
      <b>{student.name}</b>
      {student.note && <small>{student.note}</small>}
    </li>
  );
}
