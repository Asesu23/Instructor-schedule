export type Lesson = {
  id: string;
  studentId: string;
  studentName: string;
  startAt: string;
  durationMin: number;
  note: string | null;
};

export type LessonInput = {
  studentId: string;
  startAt: string;
  durationMin: number;
  note: string;
};
