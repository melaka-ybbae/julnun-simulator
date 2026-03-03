"use client";

import { useRef } from "react";
import { Camera, Image as ImageIcon } from "lucide-react";

interface Props {
  onImageLoad: (img: HTMLImageElement) => void;
}

export default function ImageUploader({ onImageLoad }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new window.Image();
    img.onload = () => onImageLoad(img);
    img.src = URL.createObjectURL(file);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold mb-2">줄눈 시뮬레이터</h1>
        <p className="text-sm text-gray-400">
          화장실/욕실 타일 사진을 업로드하면
          <br />
          줄눈 시공 후 모습을 미리 볼 수 있어요
        </p>
      </div>

      <div className="flex gap-4 w-full max-w-xs">
        <button
          onClick={() => cameraRef.current?.click()}
          className="flex-1 flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#1e1e1e] border border-[#333] active:scale-95 transition-transform"
        >
          <Camera size={32} className="text-blue-400" />
          <span className="text-sm font-medium">카메라 촬영</span>
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          className="flex-1 flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#1e1e1e] border border-[#333] active:scale-95 transition-transform"
        >
          <ImageIcon size={32} className="text-blue-400" />
          <span className="text-sm font-medium">갤러리 선택</span>
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
