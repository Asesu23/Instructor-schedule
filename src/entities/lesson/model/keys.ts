export const lessonKeys = {
  all: ['lessons'] as const,
  day: (day: string) => [...lessonKeys.all, 'day', day] as const,
  history: () => [...lessonKeys.all, 'history'] as const,
};
