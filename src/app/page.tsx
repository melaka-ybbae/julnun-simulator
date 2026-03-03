"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ImageUploader from "@/components/ImageUploader";
import ControlPanel from "@/components/ControlPanel";
import CompareSlider from "@/components/CompareSlider";
import { detectEdges, applyGroutOverlay, hexToRgb } from "@/lib/edgeDetection";
import { Loader2 } from "lucide-react";

const MAX_DIM = 1200;

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [originalDataURL, setOriginalDataURL] = useState<string>("");
  const [processedDataURL, setProcessedDataURL] = useState<string>("");
  const [processing, setProcessing] = useState(false);

  const [color, setColor] = useState("#C0C0C0");
  const [thickness, setThickness] = useState(1);
  const [sensitivity, setSensitivity] = useState(50);
  const [compareMode, setCompareMode] = useState(false);

  const originalImageDataRef = useRef<ImageData | null>(null);
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const handleImageLoad = useCallback((img: HTMLImageElement) => {
    setSourceImage(img);

    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > MAX_DIM || h > MAX_DIM) {
      const scale = MAX_DIM / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    canvasSizeRef.current = { w, h };

    const canvas = canvasRef.current!;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    originalImageDataRef.current = imageData;
    setOriginalDataURL(canvas.toDataURL("image/jpeg", 0.92));
  }, []);

  useEffect(() => {
    if (!originalImageDataRef.current) return;

    setProcessing(true);

    requestAnimationFrame(() => {
      const imgData = originalImageDataRef.current!;
      const { w, h } = canvasSizeRef.current;

      const { edgeMask } = detectEdges(imgData, sensitivity, thickness);
      const rgb = hexToRgb(color);
      const result = applyGroutOverlay(imgData, edgeMask, rgb, 0.85);

      const canvas = canvasRef.current!;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.putImageData(result, 0, 0);

      setProcessedDataURL(canvas.toDataURL("image/jpeg", 0.92));
      setProcessing(false);
    });
  }, [color, thickness, sensitivity, sourceImage]);

  const handleDownload = useCallback(() => {
    if (!processedDataURL) return;
    const a = document.createElement("a");
    a.href = processedDataURL;
    a.download = `줄눈시뮬레이션_${Date.now()}.jpg`;
    a.click();
  }, [processedDataURL]);

  const handleReset = useCallback(() => {
    setSourceImage(null);
    setOriginalDataURL("");
    setProcessedDataURL("");
    originalImageDataRef.current = null;
    setColor("#C0C0C0");
    setThickness(1);
    setSensitivity(50);
    setCompareMode(false);
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex-1 relative overflow-hidden bg-[#0a0a0a] flex items-center justify-center">
        {!sourceImage ? (
          <ImageUploader onImageLoad={handleImageLoad} />
        ) : compareMode && originalDataURL && processedDataURL ? (
          <CompareSlider
            originalSrc={originalDataURL}
            processedSrc={processedDataURL}
          />
        ) : (
          <img
            src={processedDataURL || originalDataURL}
            className="max-w-full max-h-full object-contain"
            alt="시뮬레이션 결과"
          />
        )}

        {processing && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
            <div className="flex items-center gap-2 bg-black/70 px-4 py-2 rounded-xl">
              <Loader2 size={18} className="animate-spin text-blue-400" />
              <span className="text-sm">처리 중...</span>
            </div>
          </div>
        )}
      </div>

      {sourceImage && (
        <ControlPanel
          color={color}
          onColorChange={setColor}
          thickness={thickness}
          onThicknessChange={setThickness}
          sensitivity={sensitivity}
          onSensitivityChange={setSensitivity}
          compareMode={compareMode}
          onCompareModeChange={setCompareMode}
          onDownload={handleDownload}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
