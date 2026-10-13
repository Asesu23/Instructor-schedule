import { toTime } from '@/shared/lib';
import { lessonEnd } from '../lib/time';
import type { Lesson } from '../model/types';

export function LessonItem({ lesson, onSelect }: { lesson: Lesson; onSelect: (lesson: Lesson) => void }) {
  return (
    <li onClick={() => onSelect(lesson)}>
      <b>
        {toTime(new Date(lesson.startAt))} - {toTime(new Date(lessonEnd(lesson)))}
      </b>
      <span>{lesson.studentName}</span>
      {lesson.note && <small>{lesson.note}</small>}
    </li>
  );
}
