"use client";

import {
  SamModel,
  AutoProcessor,
  RawImage,
  Tensor,
} from "@huggingface/transformers";

const MODEL_ID = "Xenova/slimsam-77-uniform";

let modelInstance: InstanceType<typeof SamModel> | null = null;
let processorInstance: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>> | null = null;
let currentEmbeddings: Record<string, unknown> | null = null;
let currentInputs: Record<string, unknown> | null = null;

export type ProgressCallback = (progress: {
  status: string;
  progress?: number;
  file?: string;
}) => void;

export async function loadModel(onProgress?: ProgressCallback): Promise<void> {
  if (modelInstance && processorInstance) return;

  processorInstance = await AutoProcessor.from_pretrained(MODEL_ID);
  modelInstance = await SamModel.from_pretrained(MODEL_ID, {
    progress_callback: onProgress,
  }) as InstanceType<typeof SamModel>;
}

export async function computeImageEmbeddings(imageUrl: string): Promise<void> {
  if (!modelInstance || !processorInstance) throw new Error("Model not loaded");
  const img = await RawImage.read(imageUrl);
  currentInputs = await (processorInstance as any)(img);
  currentEmbeddings = await (modelInstance as any).get_image_embeddings(currentInputs);
}

export async function segmentAtPoints(
  points: Array<{ x: number; y: number; label: number }>
): Promise<Float32Array> {
  if (!modelInstance || !currentEmbeddings || !currentInputs)
    throw new Error("Embeddings not computed");

  const input_points = new Tensor("float32", new Float32Array(
    points.flatMap((p) => [p.x, p.y])
  ), [1, 1, points.length, 2]);

  const input_labels = new Tensor("int64", new BigInt64Array(
    points.map((p) => BigInt(p.label))
  ), [1, 1, points.length]);

  const outputs = await (modelInstance as any)({
    ...currentEmbeddings,
    input_points,
    input_labels,
  });

  const masks = await (processorInstance as any).post_process_masks(
    outputs.pred_masks,
    (currentInputs as any).original_sizes,
    (currentInputs as any).reshaped_input_sizes,
  );

  // masks[0] shape: [1, numMasks, H, W], pick best score mask
  const scores = outputs.iou_scores.data as Float32Array;
  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > bestScore) {
      bestScore = scores[i];
      bestIdx = i;
    }
  }

  const maskTensor = masks[0];
  const dims = maskTensor.dims; // [1, numMasks, H, W]
  const H = dims[2];
  const W = dims[3];
  const totalPerMask = H * W;
  const maskData = maskTensor.data as Float32Array;

  const result = new Float32Array(totalPerMask);
  const offset = bestIdx * totalPerMask;
  for (let i = 0; i < totalPerMask; i++) {
    result[i] = maskData[offset + i] > 0 ? 1 : 0;
  }

  return result;
}

export function expandGroutByColor(
  imageData: ImageData,
  currentMask: Float32Array,
  tolerance: number = 35
): Float32Array {
  const { width: w, height: h, data } = imageData;
  const expanded = new Float32Array(w * h);

  // Get average color of current mask region
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let i = 0; i < currentMask.length; i++) {
    if (currentMask[i] > 0) {
      const idx = i * 4;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      count++;
    }
  }

  if (count === 0) return expanded;

  const avgR = rSum / count;
  const avgG = gSum / count;
  const avgB = bSum / count;

  // Find all pixels similar to grout color
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const dr = data[idx] - avgR;
    const dg = data[idx + 1] - avgG;
    const db = data[idx + 2] - avgB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < tolerance) {
      expanded[i] = 1;
    }
  }

  return expanded;
}

export function resetEmbeddings(): void {
  currentEmbeddings = null;
  currentInputs = null;
}
