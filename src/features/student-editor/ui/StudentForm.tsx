import { useState, type FormEvent } from 'react';
import { studentApi, type Student } from '@/entities/student';
import { useFormAction } from '@/shared/lib';
import { FormModal } from '@/shared/ui';

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
  const { error, run } = useFormAction(onSaved);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const body = { name, note };
    run(() => (student ? studentApi.update(student.id, body) : studentApi.create(body)));
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
        <button type="submit">Сохранить</button>
        {student && (
          <button type="button" className="danger" onClick={() => run(() => studentApi.remove(student.id))}>
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
