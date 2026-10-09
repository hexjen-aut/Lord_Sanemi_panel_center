const WHEEL_COLORS = ["#F2A65A", "#8CC7A1", "#B7A6E8", "#E8C872", "#7FB3D5", "#D97A9B", "#C9B79C", "#9FD3C7"];
const TAU = Math.PI * 2;

export interface WheelItem {
  id: string;
  label: string;
  w: number;
}

export function drawWheel(canvas: HTMLCanvasElement, items: WheelItem[], rot: number) {
  const size = canvas.clientWidth;
  const dpr = window.devicePixelRatio || 1;
  if (!size || size < 40) return;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const r = size / 2;
  ctx.clearRect(0, 0, size, size);
  if (!items.length) {
    ctx.beginPath();
    ctx.arc(r, r, r - 4, 0, TAU);
    ctx.strokeStyle = "#37324F";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    return;
  }
  const total = items.reduce((s, i) => s + i.w, 0);
  let a = rot - Math.PI / 2;
  const font = Math.max(11, Math.round(size * 0.042));
  items.forEach((it, i) => {
    const span = (it.w / total) * TAU;
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.arc(r, r, r - 4, a, a + span);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = "#1C1A2B";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(r, r);
    ctx.rotate(a + span / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1C1A2B";
    ctx.font = `600 ${font}px Arial, sans-serif`;
    const maxW = r * 0.78 - 14;
    let lbl = it.label;
    while (lbl.length > 3 && ctx.measureText(lbl).width > maxW) lbl = `${lbl.slice(0, -2)}…`;
    if (span > 0.18) ctx.fillText(lbl, r - 14, 0);
    ctx.restore();
    a += span;
  });
  ctx.beginPath();
  ctx.arc(r, r, r * 0.15, 0, TAU);
  ctx.fillStyle = "#1C1A2B";
  ctx.fill();
}

export function spinWheel(
  canvas: HTMLCanvasElement,
  items: WheelItem[],
  fromRotation: number,
  onFrame: (rotation: number) => void
): Promise<number> {
  return new Promise((resolve) => {
    if (!items.length) return resolve(-1);
    const total = items.reduce((s, i) => s + i.w, 0);
    let x = Math.random() * total;
    let idx = 0;
    for (; idx < items.length - 1; idx++) {
      x -= items[idx].w;
      if (x <= 0) break;
    }
    let start = 0;
    for (let k = 0; k < idx; k++) start += (items[k].w / total) * TAU;
    const span = (items[idx].w / total) * TAU;
    const mid = start + span * (0.2 + Math.random() * 0.6);
    const delta = ((((-mid - fromRotation) % TAU) + TAU) % TAU) + TAU * 5;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = reduced ? 250 : 3400;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 4);
      const rotation = fromRotation + delta * e;
      onFrame(rotation);
      drawWheel(canvas, items, rotation);
      if (k < 1) requestAnimationFrame(step);
      else {
        if (navigator.vibrate) navigator.vibrate(30);
        resolve(idx);
      }
    };
    requestAnimationFrame(step);
  });
}
