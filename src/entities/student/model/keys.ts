export const studentKeys = {
  all: ['students'] as const,
  list: () => [...studentKeys.all, 'list'] as const,
};
