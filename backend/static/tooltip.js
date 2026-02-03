export function attachHoverTooltip({
  containerEl,
  targetSelector,
  tooltipClassName,
  getText,
  shouldShow,
  offsetX = 12,
  offsetY = 12,
}) {
  if (!containerEl) return () => {};

  let tooltipEl = document.querySelector(`.${tooltipClassName}`);
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.className = tooltipClassName;
    tooltipEl.style.display = "none";
    document.body.append(tooltipEl);
  }

  function hide() {
    tooltipEl.style.display = "none";
  }

  function onMouseMove(ev) {
    const el = ev.target.closest?.(targetSelector);
    if (!el) return hide();

    if (shouldShow && !shouldShow(el)) return hide();

    const text = (getText ? getText(el) : el.textContent || "").trim();
    if (!text) return hide();

    tooltipEl.textContent = text;
    tooltipEl.style.display = "block";
    tooltipEl.style.left = `${ev.clientX + offsetX}px`;
    tooltipEl.style.top = `${ev.clientY + offsetY}px`;
  }

  function onMouseLeave() {
    hide();
  }

  containerEl.addEventListener("mousemove", onMouseMove);
  containerEl.addEventListener("mouseleave", onMouseLeave);

  return () => {
    containerEl.removeEventListener("mousemove", onMouseMove);
    containerEl.removeEventListener("mouseleave", onMouseLeave);
    hide();
  };
}

let _measureEl = null;

function getMeasureEl() {
  if (_measureEl) return _measureEl;
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.left = "-99999px";
  el.style.top = "-99999px";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  el.style.whiteSpace = "normal";
  el.style.wordBreak = "break-word";
  el.style.overflowWrap = "anywhere";
  document.body.append(el);
  _measureEl = el;
  return el;
}

export function isTextTruncated(el, tolerancePx = 2) {
  if (!el) return false;

  // Fast path (works for most single-line cases)
  if (el.scrollWidth - el.clientWidth > tolerancePx) return true;
  if (el.scrollHeight - el.clientHeight > tolerancePx) return true;

  // WebKit multi-line clamping can confuse scroll metrics; do a real measurement.
  const cs = window.getComputedStyle(el);
  const clamp = cs.getPropertyValue("-webkit-line-clamp")?.trim();
  const hasClamp = clamp && clamp !== "none" && clamp !== "unset" && clamp !== "initial" && clamp !== "0";
  if (!hasClamp) return false;

  const measureEl = getMeasureEl();
  measureEl.textContent = el.textContent || "";

  // Copy font-related properties that affect text size.
  measureEl.style.font = cs.font;
  measureEl.style.fontSize = cs.fontSize;
  measureEl.style.fontFamily = cs.fontFamily;
  measureEl.style.fontWeight = cs.fontWeight;
  measureEl.style.letterSpacing = cs.letterSpacing;
  measureEl.style.lineHeight = cs.lineHeight;
  measureEl.style.wordSpacing = cs.wordSpacing;

  // Match width so wrapping is equivalent.
  measureEl.style.width = `${el.clientWidth}px`;

  const naturalHeight = measureEl.getBoundingClientRect().height;
  const clampedHeight = el.getBoundingClientRect().height;
  return naturalHeight - clampedHeight > tolerancePx;
}

