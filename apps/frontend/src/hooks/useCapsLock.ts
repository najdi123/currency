'use client';

import { useEffect, useState } from 'react';

/**
 * Hook to detect if Caps Lock is currently active
 *
 * Listens to keyboard events and checks the Caps Lock modifier state.
 * Useful for showing warnings on password fields.
 *
 * @returns {boolean} - true if Caps Lock is on, false otherwise
 */
export function useCapsLock() {
  const [capsLockOn, setCapsLockOn] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.getModifierState && e.getModifierState('CapsLock')) {
        setCapsLockOn(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.getModifierState && !e.getModifierState('CapsLock')) {
        setCapsLockOn(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return capsLockOn;
}
