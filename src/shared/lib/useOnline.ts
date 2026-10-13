import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

const subscribe = (listener: () => void) => onlineManager.subscribe(listener);
const getSnapshot = () => onlineManager.isOnline();

export const useOnline = () => useSyncExternalStore(subscribe, getSnapshot);
