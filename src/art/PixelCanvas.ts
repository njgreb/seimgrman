import { OUTLINE, hexToRgb, luminance, rgbToHex } from './palette';

// A tiny indexed-ish drawing surface: each pixel is a hex color string or null (transparent).
// Sprites are drawn as flat fills, then `outline()` adds the dark silhouette edge.
export class PixelCanvas {
  readonly data: (string | null)[];

  constructor(readonly width: number, readonly height: number) {
    this.data = new Array(width * height).fill(null);
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return this.data[y * this.width + x];
  }

  set(x: number, y: number, c: string | null): this {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return this;
    this.data[y * this.width + x] = c;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string | null): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  // Filled rect with the four corner pixels knocked out.
  round(x: number, y: number, w: number, h: number, c: string): this {
    this.rect(x, y, w, h, c);
    for (const [cx, cy] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) this.set(cx, cy, null);
    return this;
  }

  pixels(points: [number, number][], c: string): this {
    for (const [x, y] of points) this.set(x, y, c);
    return this;
  }

  // Draw rows of characters, mapping each char through `colors` ('.' / unmapped = skip).
  grid(x: number, y: number, rows: string[], colors: Record<string, string | null>): this {
    rows.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        if (ch in colors) this.set(x + i, y + j, colors[ch]);
      });
    });
    return this;
  }

  // Only paints where this canvas is currently opaque.
  paintOver(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.get(x + i, y + j)) this.set(x + i, y + j, c);
    return this;
  }

  blit(src: PixelCanvas, dx: number, dy: number): this {
    for (let y = 0; y < src.height; y++)
      for (let x = 0; x < src.width; x++) {
        const c = src.get(x, y);
        if (c) this.set(dx + x, dy + y, c);
      }
    return this;
  }

  // Adds a 1px outline around opaque pixels. Edges that are already dark (e.g. imported art
  // with its own outline) are left alone so outlines don't double up.
  outline(color = OUTLINE, darkThreshold = 60): this {
    const add: number[] = [];
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        if (this.get(x, y)) continue;
        const neighbors = [this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)];
        if (neighbors.some((n) => n && luminance(n) > darkThreshold)) add.push(y * this.width + x);
      }
    for (const i of add) this.data[i] = color;
    return this;
  }

  flipX(): PixelCanvas {
    const out = new PixelCanvas(this.width, this.height);
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) out.set(this.width - 1 - x, y, this.get(x, y));
    return out;
  }

  crop(x: number, y: number, w: number, h: number): PixelCanvas {
    const out = new PixelCanvas(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.set(i, j, this.get(x + i, y + j));
    return out;
  }

  scale(k: number): PixelCanvas {
    const out = new PixelCanvas(this.width * k, this.height * k);
    for (let y = 0; y < out.height; y++)
      for (let x = 0; x < out.width; x++) out.set(x, y, this.get(Math.floor(x / k), Math.floor(y / k)));
    return out;
  }

  writeTo(ctx: CanvasRenderingContext2D, ox = 0, oy = 0): void {
    const img = ctx.getImageData(ox, oy, this.width, this.height);
    for (let i = 0; i < this.data.length; i++) {
      const c = this.data[i];
      if (!c) continue;
      const [r, g, b] = hexToRgb(c);
      img.data.set([r, g, b, 255], i * 4);
    }
    ctx.putImageData(img, ox, oy);
  }

  static fromImage(img: CanvasImageSource & { width: number; height: number }): PixelCanvas {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    const out = new PixelCanvas(img.width, img.height);
    for (let i = 0; i < img.width * img.height; i++) {
      if (data[i * 4 + 3] < 128) continue;
      out.data[i] = rgbToHex([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
    }
    return out;
  }
}
