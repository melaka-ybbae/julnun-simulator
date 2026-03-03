"use client";

import { ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";

interface Props {
  color: string;
  onColorChange: (color: string) => void;
  thickness: number;
  onThicknessChange: (v: number) => void;
  sensitivity: number;
  onSensitivityChange: (v: number) => void;
  compareMode: boolean;
  onCompareModeChange: (v: boolean) => void;
  onDownload: () => void;
  onReset: () => void;
}

const PRESETS = [
  { name: "밝은 회색", color: "#C0C0C0" },
  { name: "흰색", color: "#FFFFFF" },
  { name: "검정", color: "#2A2A2A" },
  { name: "베이지", color: "#D4B896" },
  { name: "진회색", color: "#666666" },
  { name: "브라운", color: "#8B6F47" },
];

export default function ControlPanel({
  color,
  onColorChange,
  thickness,
  onThicknessChange,
  sensitivity,
  onSensitivityChange,
  compareMode,
  onCompareModeChange,
  onDownload,
  onReset,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-[#161616] border-t border-[#333] rounded-t-2xl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3"
      >
        <span className="text-sm font-semibold">줄눈 설정</span>
        {expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5">
          <div>
            <label className="text-xs text-gray-400 mb-2 block">줄눈 색상</label>
            <div className="flex gap-2 flex-wrap">
              {PRESETS.map((p) => (
                <button
                  key={p.color}
                  onClick={() => onColorChange(p.color)}
                  className={`w-9 h-9 rounded-full border-2 transition-all ${
                    color === p.color
                      ? "border-blue-400 scale-110"
                      : "border-[#444]"
                  }`}
                  style={{ background: p.color }}
                  title={p.name}
                />
              ))}
              <label
                className={`w-9 h-9 rounded-full border-2 overflow-hidden cursor-pointer relative ${
                  !PRESETS.some((p) => p.color === color)
                    ? "border-blue-400 scale-110"
                    : "border-[#444]"
                }`}
                style={{
                  background:
                    "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                }}
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => onColorChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-gray-400">줄눈 두께</label>
              <span className="text-xs text-gray-500">{thickness}</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              value={thickness}
              onChange={(e) => onThicknessChange(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-gray-400">엣지 감도</label>
              <span className="text-xs text-gray-500">{sensitivity}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={sensitivity}
              onChange={(e) => onSensitivityChange(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onCompareModeChange(!compareMode)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                compareMode
                  ? "bg-blue-500 text-white"
                  : "bg-[#1e1e1e] text-gray-300 border border-[#333]"
              }`}
            >
              {compareMode ? "비교 모드 ON" : "비교 모드"}
            </button>
            <button
              onClick={onDownload}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-500 text-white active:bg-blue-600 transition-colors"
            >
              이미지 저장
            </button>
            <button
              onClick={onReset}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-[#1e1e1e] text-gray-400 border border-[#333]"
            >
              초기화
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
