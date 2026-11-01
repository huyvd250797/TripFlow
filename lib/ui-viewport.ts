/** Keep sheets inside the visible viewport, including keyboard transitions. */
export function syncDialogViewport() {
  const visual = window.visualViewport;
  const editing = document.activeElement?.matches(
    'input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]',
  );
  let height = visual?.height || window.innerHeight;
  let top = Math.max(0, visual?.offsetTop || 0);
  // Safari can retain the keyboard-sized visual viewport briefly after blur.
  // Once focus leaves an editor, the layout viewport is the recovery baseline.
  if (
    !editing &&
    window.innerHeight - height > 120 &&
    (visual?.scale || 1) === 1
  ) {
    height = window.innerHeight;
    top = 0;
  }
  const style = document.documentElement.style;
  style.setProperty("--tf-viewport-height", `${Math.round(height)}px`);
  style.setProperty("--tf-viewport-top", `${Math.round(top)}px`);
  style.setProperty("--tf-viewport-bottom", `${Math.round(top + height)}px`);
  document.documentElement.dataset.keyboard =
    editing && window.innerHeight - height > 120 ? "open" : "closed";
}

export function observeDialogViewport() {
  let frame = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const sync = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(syncDialogViewport);
  };
  const settle = () => {
    sync();
    // Keyboard / browser toolbar animations may finish without a final resize.
    for (const delay of [80, 300, 650]) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        sync();
      }, delay);
      timers.add(timer);
    }
  };
  syncDialogViewport();
  const events = [
    "resize",
    "orientationchange",
    "pageshow",
    "tripflow:sync-viewport",
  ];
  events.forEach((event) => window.addEventListener(event, settle));
  document.addEventListener("focusin", settle);
  document.addEventListener("focusout", settle);
  window.visualViewport?.addEventListener("resize", sync);
  window.visualViewport?.addEventListener("scroll", sync);
  return () => {
    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    events.forEach((event) => window.removeEventListener(event, settle));
    document.removeEventListener("focusin", settle);
    document.removeEventListener("focusout", settle);
    window.visualViewport?.removeEventListener("resize", sync);
    window.visualViewport?.removeEventListener("scroll", sync);
  };
}
