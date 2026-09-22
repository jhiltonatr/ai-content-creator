import { useState } from 'react';

export function useMessage() {
  const [msg, setMsg] = useState<string | null>(null);
  return { msg, setMsg };
}