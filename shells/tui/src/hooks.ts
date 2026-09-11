// SPDX-License-Identifier: MPL-2.0
// Live terminal size - drives the responsive layout (wide = desktop two-pane,
// narrow = mobile single-column), re-rendering on resize just like a CSS breakpoint.
import { useStdout } from 'ink';
import { useState, useEffect } from 'react';

export interface TermSize { cols: number; rows: number }

export function useTermSize(): TermSize {
  const { stdout } = useStdout();
  const read = (): TermSize => ({ cols: stdout?.columns ?? 80, rows: stdout?.rows ?? 24 });
  const [size, setSize] = useState<TermSize>(read);
  useEffect(() => {
    if (!stdout) return;
    const on = (): void => setSize(read);
    stdout.on('resize', on);
    return () => { stdout.off('resize', on); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stdout]);
  return size;
}
