import { useEffect } from 'react';

const TAPE_SELECTOR = '.landing-tape, .group-card.album-sheet, .invite-summary-card.album-sheet';

export function usePaperTapeAngles() {
  useEffect(() => {
    const initialized = new WeakSet<HTMLElement>();
    const initialize = (element: Element) => {
      if (!(element instanceof HTMLElement) || initialized.has(element)) return;
      initialized.add(element);
      element.style.setProperty('--tape-angle', `${(Math.random() * 12 - 6).toFixed(2)}deg`);
    };
    const scan = (root: Element) => {
      if (root.matches(TAPE_SELECTOR)) initialize(root);
      root.querySelectorAll(TAPE_SELECTOR).forEach(initialize);
    };

    scan(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes' && record.target instanceof Element) {
          if (record.target.matches(TAPE_SELECTOR)) initialize(record.target);
        }
        for (const node of record.addedNodes) {
          if (node instanceof Element) scan(node);
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);
}
