import { useEffect, useLayoutEffect } from 'react';

export const useCommittedLayoutEffect =
  typeof document === 'undefined' ? useEffect : useLayoutEffect;
