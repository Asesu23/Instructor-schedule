import { useState, type FormEvent } from 'react';
import { useLessonCache } from '@/entities/lesson';
import type { Student } from '@/entities/student';
import { newId } from '@/shared/lib';
import { FormModal } from '@/shared/ui';
import { useDeleteStudent, useSaveStudent } from '../model/useStudentMutations';

export function StudentForm({
  student,
  onClose,
  onSaved,
}: {
  student: Student | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(student?.name ?? '');
  const [note, setNote] = useState(student?.note ?? '');
  const [error, setError] = useState('');
  const saveStudent = useSaveStudent();
  const deleteStudent = useDeleteStudent();
  const cache = useLessonCache();

  const save = (e: FormEvent) => {
    e.preventDefault();
    saveStudent.mutate({ id: student?.id ?? newId(), isNew: !student, body: { name, note } });
    onSaved();
  };

  const remove = () => {
    if (!student) return;
    if (cache.hasLessonsFor(student.id)) {
      setError('У ученика есть занятия');
      return;
    }
    deleteStudent.mutate(student.id);
    onSaved();
  };

  return (
    <FormModal onClose={onClose} onSubmit={save}>
      <h2>{student ? 'Ученик' : 'Новый ученик'}</h2>
      <label>
        Имя и фамилия
        <input
          value={name}
          maxLength={100}
          placeholder="Иван Иванов"
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label>
        Заметка
        <input value={note} maxLength={500} placeholder="Заметка" onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit">
          Сохранить
        </button>
        {student && (
          <button type="button" className="danger" onClick={remove}>
            Удалить
          </button>
        )}
        <button type="button" onClick={onClose}>
          Отмена
        </button>
      </div>
    </FormModal>
  );
}
