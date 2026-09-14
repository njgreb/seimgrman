import sharp, { type Sharp } from 'sharp';
import { PixelCanvas } from '../src/art/PixelCanvas.ts';
import { hexToRgb, rgbToHex } from '../src/art/palette.ts';

export interface Raw {
  data: Buffer;
  width: number;
  height: number;
}

export async function readRaw(file: string): Promise<Raw> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

export function rawToCanvas({ data, width, height }: Raw): PixelCanvas {
  const pc = new PixelCanvas(width, height);
  for (let i = 0; i < width * height; i++) {
    if (data[i * 4 + 3] >= 128) pc.data[i] = rgbToHex([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
  }
  return pc;
}

export function canvasToRaw(pc: PixelCanvas, background?: string): Raw {
  const data = Buffer.alloc(pc.width * pc.height * 4);
  const bg = background ? [...hexToRgb(background), 255] : [0, 0, 0, 0];
  for (let i = 0; i < pc.data.length; i++) {
    const c = pc.data[i];
    data.set(c ? [...hexToRgb(c), 255] : bg, i * 4);
  }
  return { data, width: pc.width, height: pc.height };
}

export function toSharp({ data, width, height }: Raw): Sharp {
  return sharp(data, { raw: { width, height, channels: 4 } });
}
