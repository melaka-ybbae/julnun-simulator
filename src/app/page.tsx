"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ImageUploader from "@/components/ImageUploader";
import ControlPanel from "@/components/ControlPanel";
import CompareSlider from "@/components/CompareSlider";
import {
  loadModel,
  computeImageEmbeddings,
  segmentAtPoints,
  expandGroutByColor,
  resetEmbeddings,
  type ProgressCallback,
} from "@/lib/sam";
import { Loader2 } from "lucide-react";

const MAX_DIM = 1024;

interface ClickPoint {
  x: number;
  y: number;
  label: number; // 1=foreground, 0=background
  // display coords (relative to displayed image)
  displayX: number;
  displayY: number;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgContainerRef = useRef<HTMLDivElement>(null);

  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [originalDataURL, setOriginalDataURL] = useState("");
  const [processedDataURL, setProcessedDataURL] = useState("");
  const [processing, setProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");

  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [embeddingsReady, setEmbeddingsReady] = useState(false);

  const [clickPoints, setClickPoints] = useState<ClickPoint[]>([]);
  const [currentMask, setCurrentMask] = useState<Float32Array | null>(null);

  const [color, setColor] = useState("#C0C0C0");
  const [compareMode, setCompareMode] = useState(false);

  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const originalImageDataRef = useRef<ImageData | null>(null);
  const imageUrlRef = useRef<string>("");

  // Load model on mount
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setModelLoading(true);
      setStatusText("AI 모델 다운로드 중...");
      const onProgress: ProgressCallback = (p) => {
        if (p.status === "progress" && p.progress !== undefined) {
          setLoadProgress(Math.round(p.progress));
        }
      };
      try {
        await loadModel(onProgress);
        if (!cancelled) {
          setModelLoaded(true);
          setStatusText("");
        }
      } catch (e) {
        console.error("Model load failed:", e);
        if (!cancelled) setStatusText("모델 로드 실패. 새로고침 해주세요.");
      } finally {
        if (!cancelled) setModelLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const handleImageLoad = useCallback(
    async (img: HTMLImageElement) => {
      setSourceImage(img);
      setClickPoints([]);
      setCurrentMask(null);
      setProcessedDataURL("");
      setEmbeddingsReady(false);

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
      originalImageDataRef.current = ctx.getImageData(0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      setOriginalDataURL(dataUrl);
      imageUrlRef.current = dataUrl;

      // Compute embeddings
      if (modelLoaded) {
        setProcessing(true);
        setStatusText("이미지 분석 중...");
        try {
          resetEmbeddings();
          await computeImageEmbeddings(dataUrl);
          setEmbeddingsReady(true);
          setStatusText("줄눈 부분을 탭하세요");
        } catch (e) {
          console.error("Embedding failed:", e);
          setStatusText("이미지 분석 실패");
        } finally {
          setProcessing(false);
        }
      }
    },
    [modelLoaded]
  );

  // Re-compute embeddings when model finishes loading after image was already set
  useEffect(() => {
    if (modelLoaded && sourceImage && !embeddingsReady && imageUrlRef.current) {
      (async () => {
        setProcessing(true);
        setStatusText("이미지 분석 중...");
        try {
          resetEmbeddings();
          await computeImageEmbeddings(imageUrlRef.current);
          setEmbeddingsReady(true);
          setStatusText("줄눈 부분을 탭하세요");
        } catch (e) {
          console.error(e);
          setStatusText("이미지 분석 실패");
        } finally {
          setProcessing(false);
        }
      })();
    }
  }, [modelLoaded, sourceImage, embeddingsReady]);

  // Run SAM segmentation when points change
  useEffect(() => {
    if (!embeddingsReady || clickPoints.length === 0) return;
    let cancelled = false;

    (async () => {
      setProcessing(true);
      setStatusText("세그멘테이션 중...");
      try {
        const { w, h } = canvasSizeRef.current;
        const samPoints = clickPoints.map((p) => ({
          x: p.x,
          y: p.y,
          label: p.label,
        }));
        const mask = await segmentAtPoints(samPoints);
        if (cancelled) return;
        setCurrentMask(mask);
        applyOverlay(mask, color);
        setStatusText(`${clickPoints.length}개 포인트 선택됨`);
      } catch (e) {
        console.error("Segmentation failed:", e);
        setStatusText("세그멘테이션 실패");
      } finally {
        if (!cancelled) setProcessing(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clickPoints, embeddingsReady]);

  // Re-apply overlay when color changes
  useEffect(() => {
    if (currentMask) {
      applyOverlay(currentMask, color);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  const applyOverlay = useCallback(
    (mask: Float32Array, hexColor: string) => {
      const imgData = originalImageDataRef.current;
      if (!imgData) return;
      const { w, h } = canvasSizeRef.current;

      const result = new ImageData(new Uint8ClampedArray(imgData.data), w, h);
      const rgb = hexToRgb(hexColor);
      const opacity = 0.85;

      for (let i = 0; i < mask.length; i++) {
        if (mask[i] > 0) {
          const idx = i * 4;
          result.data[idx] = result.data[idx] * (1 - opacity) + rgb.r * opacity;
          result.data[idx + 1] = result.data[idx + 1] * (1 - opacity) + rgb.g * opacity;
          result.data[idx + 2] = result.data[idx + 2] * (1 - opacity) + rgb.b * opacity;
        }
      }

      const canvas = canvasRef.current!;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.putImageData(result, 0, 0);
      setProcessedDataURL(canvas.toDataURL("image/jpeg", 0.92));
    },
    []
  );

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!embeddingsReady || processing) return;

      const container = imgContainerRef.current;
      if (!container) return;
      const imgEl = container.querySelector("img");
      if (!imgEl) return;

      const rect = imgEl.getBoundingClientRect();
      let clientX: number, clientY: number;
      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const relX = clientX - rect.left;
      const relY = clientY - rect.top;

      const { w, h } = canvasSizeRef.current;
      const imgX = Math.round((relX / rect.width) * w);
      const imgY = Math.round((relY / rect.height) * h);

      if (imgX < 0 || imgX >= w || imgY < 0 || imgY >= h) return;

      const newPoint: ClickPoint = {
        x: imgX,
        y: imgY,
        label: 1,
        displayX: relX,
        displayY: relY,
      };

      setClickPoints((prev) => [...prev, newPoint]);
    },
    [embeddingsReady, processing]
  );

  const handleExpandAll = useCallback(() => {
    if (!currentMask || !originalImageDataRef.current) return;
    setProcessing(true);
    setStatusText("전체 줄눈 탐색 중...");

    requestAnimationFrame(() => {
      const expanded = expandGroutByColor(
        originalImageDataRef.current!,
        currentMask,
        35
      );
      setCurrentMask(expanded);
      applyOverlay(expanded, color);
      setStatusText("전체 줄눈 선택 완료");
      setProcessing(false);
    });
  }, [currentMask, color, applyOverlay]);

  const handleClearPoints = useCallback(() => {
    setClickPoints([]);
    setCurrentMask(null);
    setProcessedDataURL("");
    setStatusText("줄눈 부분을 탭하세요");
  }, []);

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
    setClickPoints([]);
    setCurrentMask(null);
    setCompareMode(false);
    setColor("#C0C0C0");
    setEmbeddingsReady(false);
    setStatusText("");
    resetEmbeddings();
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex-1 relative overflow-hidden bg-[#0a0a0a] flex items-center justify-center">
        {!sourceImage ? (
          <>
            <ImageUploader onImageLoad={handleImageLoad} />
            {modelLoading && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-xl text-xs text-gray-300 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-blue-400" />
                AI 모델 로딩 중... {loadProgress}%
              </div>
            )}
          </>
        ) : compareMode && originalDataURL && processedDataURL ? (
          <CompareSlider
            originalSrc={originalDataURL}
            processedSrc={processedDataURL}
          />
        ) : (
          <div
            ref={imgContainerRef}
            className="relative max-w-full max-h-full flex items-center justify-center"
            onClick={handleImageClick}
            onTouchEnd={(e) => {
              // Prevent double-fire; use touchEnd for mobile
            }}
          >
            <img
              src={processedDataURL || originalDataURL}
              className="max-w-full max-h-full object-contain"
              alt="시뮬레이션 결과"
              draggable={false}
            />
            {/* Click point indicators */}
            {clickPoints.map((pt, i) => {
              // Recompute display positions relative to current img size
              const imgEl = imgContainerRef.current?.querySelector("img");
              if (!imgEl) return null;
              const rect = imgEl.getBoundingClientRect();
              const { w, h } = canvasSizeRef.current;
              const dx = (pt.x / w) * rect.width;
              const dy = (pt.y / h) * rect.height;
              return (
                <div
                  key={i}
                  className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 shadow-lg"
                  style={{
                    left: dx,
                    top: dy,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Status overlay */}
        {(processing || statusText) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
            <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-xl">
              {processing && (
                <Loader2 size={14} className="animate-spin text-blue-400" />
              )}
              <span className="text-xs text-gray-200">{statusText}</span>
            </div>
          </div>
        )}
      </div>

      {sourceImage && (
        <ControlPanel
          color={color}
          onColorChange={setColor}
          compareMode={compareMode}
          onCompareModeChange={setCompareMode}
          onDownload={handleDownload}
          onReset={handleReset}
          onExpandAll={handleExpandAll}
          onClearPoints={handleClearPoints}
          hasPoints={clickPoints.length > 0}
          hasMask={currentMask !== null}
        />
      )}
    </div>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 128, g: 128, b: 128 };
}
