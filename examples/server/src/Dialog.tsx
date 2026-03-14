'use client';

import { type ReactNode, useRef } from 'react';

export function Dialog({
  trigger,
  error,
  children,
}: {
  error: Error;
  trigger: ReactNode;
  children: ReactNode;
}) {
  console.log('Dialog error:', error);
  const ref = useRef<HTMLDialogElement | null>(null);
  return (
    <>
      <button onClick={() => ref.current?.showModal()}>{trigger}</button>
      <dialog ref={ref} onSubmit={() => ref.current?.close()}>
        {children}
      </dialog>
    </>
  );
}
