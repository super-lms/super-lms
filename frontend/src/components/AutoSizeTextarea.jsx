import { useLayoutEffect, useRef } from 'react';

export default function AutoSizeTextarea({ value, rows = 2, style, ...props }) {
  const ref = useRef(null);
  const resize = () => {
    const element = ref.current;
    if (!element || !element.clientWidth) return;
    element.style.height = 'auto';
    const border = element.offsetHeight - element.clientHeight;
    element.style.height = `${element.scrollHeight + border + 2}px`;
  };
  useLayoutEffect(resize, [value, rows]);
  useLayoutEffect(() => {
    const element = ref.current;
    let width = element.clientWidth, active = true;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== width) { width = element.clientWidth; resize(); }
    });
    observer.observe(element);
    const onFontsLoaded = () => { if (active) resize(); };
    document.fonts?.ready.then(onFontsLoaded);
    document.fonts?.addEventListener('loadingdone', onFontsLoaded);
    return () => { active = false; observer.disconnect(); document.fonts?.removeEventListener('loadingdone', onFontsLoaded); };
  }, []);
  return <textarea {...props} ref={ref} value={value} rows={rows} style={{ ...style,
    boxSizing: 'border-box', minHeight: 0, maxHeight: 'none', height: 'auto', overflow: 'hidden', resize: 'none', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }} />;
}
