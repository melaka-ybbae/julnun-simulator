export interface EdgeDetectionResult {
  edgeMask: ImageData;
  width: number;
  height: number;
}

function toGrayscale(imageData: ImageData): Float32Array {
  const gray = new Float32Array(imageData.width * imageData.height);
  const d = imageData.data;
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
  }
  return gray;
}

function gaussianBlur(gray: Float32Array, w: number, h: number): Float32Array {
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const kSum = 16;
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sum = 0;
      let ki = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += gray[(y + ky) * w + (x + kx)] * kernel[ki++];
        }
      }
      out[y * w + x] = sum / kSum;
    }
  }
  return out;
}

function sobel(gray: Float32Array, w: number, h: number): Float32Array {
  const magnitude = new Float32Array(w * h);
  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sumX = 0, sumY = 0;
      let ki = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const val = gray[(y + ky) * w + (x + kx)];
          sumX += val * gx[ki];
          sumY += val * gy[ki];
          ki++;
        }
      }
      magnitude[y * w + x] = Math.sqrt(sumX * sumX + sumY * sumY);
    }
  }
  return magnitude;
}

function dilate(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let found = false;
      for (let dy = -radius; dy <= radius && !found; dy++) {
        for (let dx = -radius; dx <= radius && !found; dx++) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w && mask[ny * w + nx]) {
            found = true;
          }
        }
      }
      out[y * w + x] = found ? 255 : 0;
    }
  }
  return out;
}

export function detectEdges(
  imageData: ImageData,
  sensitivity: number = 50,
  thickness: number = 1
): EdgeDetectionResult {
  const { width: w, height: h } = imageData;

  const gray = toGrayscale(imageData);
  const blurred = gaussianBlur(gray, w, h);
  const edges = sobel(blurred, w, h);

  let maxVal = 0;
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] > maxVal) maxVal = edges[i];
  }

  const threshold = ((100 - sensitivity) / 100) * maxVal * 0.5;
  const binaryMask = new Uint8Array(w * h);
  for (let i = 0; i < edges.length; i++) {
    binaryMask[i] = edges[i] > threshold ? 255 : 0;
  }

  const dilatedMask = thickness > 0 ? dilate(binaryMask, w, h, thickness) : binaryMask;

  const result = new ImageData(w, h);
  for (let i = 0; i < dilatedMask.length; i++) {
    const idx = i * 4;
    result.data[idx] = dilatedMask[i];
    result.data[idx + 1] = dilatedMask[i];
    result.data[idx + 2] = dilatedMask[i];
    result.data[idx + 3] = 255;
  }

  return { edgeMask: result, width: w, height: h };
}

export function applyGroutOverlay(
  originalImageData: ImageData,
  edgeMask: ImageData,
  color: { r: number; g: number; b: number },
  opacity: number = 0.85
): ImageData {
  const w = originalImageData.width;
  const h = originalImageData.height;
  const result = new ImageData(new Uint8ClampedArray(originalImageData.data), w, h);

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const maskValue = edgeMask.data[idx] / 255;

    if (maskValue > 0.5) {
      const blend = opacity * maskValue;
      result.data[idx] = result.data[idx] * (1 - blend) + color.r * blend;
      result.data[idx + 1] = result.data[idx + 1] * (1 - blend) + color.g * blend;
      result.data[idx + 2] = result.data[idx + 2] * (1 - blend) + color.b * blend;
    }
  }

  return result;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 128, g: 128, b: 128 };
}
