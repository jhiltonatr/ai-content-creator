import { useCallback, useEffect, useRef, useState } from 'react';

export function useList<T>(loader: () => Promise<T[]>): { items: T[]; reload: () => void } {
  const [items, setItems] = useState<T[]>([]);
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const reload = useCallback(() => {
    loaderRef.current().then(setItems);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, reload };
}