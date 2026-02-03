export function attachHoverTooltip({
  containerEl,
  targetSelector,
  tooltipClassName,
  getText,
  shouldShow,
  offsetX = 12,
  offsetY = 12,
  viewportPadding = 12,
  minWidth = 260,
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

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function clampTooltipX(x) {
    // Keep a healthy right margin so the tooltip doesn't shrink-to-fit into a skinny column.
    const maxX = window.innerWidth - viewportPadding - Math.min(minWidth, window.innerWidth - 2 * viewportPadding);
    return clamp(x, viewportPadding, Math.max(viewportPadding, maxX));
  }

  function onMouseMove(ev) {
    const el = ev.target.closest?.(targetSelector);
    if (!el) return hide();

    if (shouldShow && !shouldShow(el)) return hide();

    const text = (getText ? getText(el) : el.textContent || "").trim();
    if (!text) return hide();

    tooltipEl.textContent = text;
    tooltipEl.style.display = "block";
    const x = clampTooltipX(ev.clientX + offsetX);
    const y = clamp(ev.clientY + offsetY, viewportPadding, window.innerHeight - viewportPadding);
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
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

export function createPinnedTooltip({ id, className }) {
  let tooltipEl = document.getElementById(id);
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = id;
    tooltipEl.className = className;
    tooltipEl.style.display = "none";
    document.body.append(tooltipEl);
  }

  let _visible = false;

  function hide() {
    tooltipEl.style.display = "none";
    _visible = false;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function clampTooltipX(x, viewportPadding = 12, minWidth = 260) {
    const maxX = window.innerWidth - viewportPadding - Math.min(minWidth, window.innerWidth - 2 * viewportPadding);
    return clamp(x, viewportPadding, Math.max(viewportPadding, maxX));
  }

  function showNearElement({ anchorEl, text, prefer = "below" }) {
    const t = (text || "").trim();
    if (!anchorEl || !t) return hide();

    tooltipEl.textContent = t;
    tooltipEl.style.display = "block";

    // Measure after display so we can clamp to viewport.
    const rect = anchorEl.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();
    const pad = 10;

    let x = rect.left + 8;
    let y = prefer === "above" ? rect.top - tipRect.height - 8 : rect.bottom + 8;

    // If preferred placement would go off-screen, flip.
    if (y + tipRect.height + pad > window.innerHeight) {
      y = rect.top - tipRect.height - 8;
    }
    if (y < pad) {
      y = rect.bottom + 8;
    }

    x = clampTooltipX(x, pad, 260);
    y = clamp(y, pad, window.innerHeight - tipRect.height - pad);

    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
    _visible = true;
  }

  function isVisible() {
    return _visible;
  }

  return { el: tooltipEl, showNearElement, hide, isVisible };
}

