/** SVG path data for the `draw` action. Pure so it can be tested. Coordinates are in px of the box. */
export type DrawShape = "arrow" | "line" | "circle" | "rect" | "underline" | "check" | "cross" | "star" | "bracket";

const f = (n: number) => Math.round(n * 100) / 100;

export function shapePath(shape: DrawShape, W: number, H: number, flip: boolean): string {
  const fx = (x: number) => f(flip ? W - x : x);
  const P = (x: number, y: number) => `${fx(x)},${f(y)}`;
  switch (shape) {
    case "line":
      return `M${P(0, 0)} L${P(W, H)}`;
    case "arrow": {
      const len = Math.hypot(W, H) || 1;
      const ang = Math.atan2(H, W);
      const head = Math.max(22, Math.min(60, len * 0.22));
      const a1 = ang + Math.PI - 0.5;
      const a2 = ang + Math.PI + 0.5;
      return (
        `M${P(0, 0)} L${P(W, H)} ` +
        `M${P(W + Math.cos(a1) * head, H + Math.sin(a1) * head)} L${P(W, H)} L${P(W + Math.cos(a2) * head, H + Math.sin(a2) * head)}`
      );
    }
    case "circle": {
      const rx = W / 2;
      const ry = H / 2;
      const cx = W / 2;
      const cy = H / 2;
      // starts at the top and overshoots slightly, like a hand-drawn loop
      return (
        `M${P(cx, 0)} A${f(rx)},${f(ry)} 0 1 1 ${P(cx, H)} A${f(rx)},${f(ry)} 0 1 1 ${P(cx - rx * 0.12, cy - ry * 0.98)}`
      );
    }
    case "rect": {
      const r = Math.min(18, W / 6, H / 6);
      return (
        `M${P(r, 0)} L${P(W - r, 0)} Q${P(W, 0)} ${P(W, r)} L${P(W, H - r)} Q${P(W, H)} ${P(W - r, H)} ` +
        `L${P(r, H)} Q${P(0, H)} ${P(0, H - r)} L${P(0, r)} Q${P(0, 0)} ${P(r, 0)}`
      );
    }
    case "underline": {
      const y = H / 2;
      return `M${P(0, y)} Q${P(W * 0.25, y - 8)} ${P(W * 0.5, y)} T${P(W, y)}`;
    }
    case "check":
      return `M${P(W * 0.1, H * 0.55)} L${P(W * 0.38, H * 0.88)} L${P(W * 0.92, H * 0.12)}`;
    case "cross":
      return `M${P(W * 0.1, H * 0.1)} L${P(W * 0.9, H * 0.9)} M${P(W * 0.9, H * 0.1)} L${P(W * 0.1, H * 0.9)}`;
    case "star": {
      const cx = W / 2;
      const cy = H / 2;
      const pts: string[] = [];
      for (let i = 0; i < 5; i++) {
        const k = (i * 2 * Math.PI * 2) / 5 - Math.PI / 2; // pentagram order
        pts.push(P(cx + (Math.cos(k) * W) / 2, cy + (Math.sin(k) * H) / 2));
      }
      return `M${pts[0]} L${pts[1]} L${pts[2]} L${pts[3]} L${pts[4]} Z`;
    }
    case "bracket": {
      const d = Math.min(24, W);
      return `M${P(d, 0)} L${P(0, 0)} L${P(0, H)} L${P(d, H)}`;
    }
  }
}
