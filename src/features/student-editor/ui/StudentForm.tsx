import { useState, type FormEvent } from 'react';
import type { Student } from '@/entities/student';
import { errorMessage } from '@/shared/lib';
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
  const saveStudent = useSaveStudent();
  const deleteStudent = useDeleteStudent();
  const pending = saveStudent.isPending || deleteStudent.isPending;
  const error = saveStudent.error ?? deleteStudent.error;

  const save = (e: FormEvent) => {
    e.preventDefault();
    deleteStudent.reset();
    saveStudent.mutate({ id: student?.id ?? null, body: { name, note } }, { onSuccess: onSaved });
  };

  const remove = () => {
    if (!student) return;
    saveStudent.reset();
    deleteStudent.mutate(student.id, { onSuccess: onSaved });
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
      {error && <p className="error">{errorMessage(error)}</p>}
      <div className="row">
        <button type="submit" disabled={pending}>
          Сохранить
        </button>
        {student && (
          <button type="button" className="danger" disabled={pending} onClick={remove}>
            Удалить
          </button>
        )}
        <button type="button" disabled={pending} onClick={onClose}>
          Отмена
        </button>
      </div>
    </FormModal>
  );
}
