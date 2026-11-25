import { useEffect, useState } from 'react';

export type ViewportMode = 'desktop' | 'mobile-portrait' | 'mobile-landscape';

export interface ViewportInfo {
  mode: ViewportMode;
  width: number;
  height: number;
}

function readViewport(): ViewportInfo {
  if (typeof window === 'undefined') {
    return { mode: 'desktop', width: 1280, height: 800 };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  let mode: ViewportMode = 'desktop';

  // Phones held in landscape typically have CSS viewport height <= 540px
  if (height <= 540 && width > height) {
    mode = 'mobile-landscape';
  } else if (width < 1024 && height >= width) {
    mode = 'mobile-portrait';
  } else if (width < 768) {
    mode = 'mobile-portrait';
  }

  return { mode, width, height };
}

export function useViewportMode(): ViewportInfo {
  const [info, setInfo] = useState<ViewportInfo>(readViewport);

  useEffect(() => {
    const update = () => {
      const next = readViewport();
      setInfo((prev) =>
        prev.mode === next.mode && prev.width === next.width && prev.height === next.height
          ? prev
          : next,
      );
    };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return info;
}
