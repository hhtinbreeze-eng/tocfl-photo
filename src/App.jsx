import React, { useEffect, useRef, useState } from "react";
import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";

const OUTPUT_WIDTH = 600;
const OUTPUT_HEIGHT = 800;
const TARGET_TOP_Y = OUTPUT_HEIGHT * 0.06;
const TARGET_CHIN_Y = OUTPUT_HEIGHT * 0.88;

const EXAMPLE_SRC = `${import.meta.env.BASE_URL}example-qualified.jpg`;
const MEDIAPIPE_PATH = `${import.meta.env.BASE_URL}mediapipe/`;

const i18n = {
  zh: {
    title: "華測會大頭照處理系統",
    passport: "護照號碼",
    name: "姓名",
    upload: "上傳照片",
    processing: "處理中...",
    initModel: "正在初始化模型...",
    zoom: "縮放 Zoom",
    moveX: "左右移動",
    moveY: "上下移動",
    download: "下載成品照片",
    bgStatus: "背景狀態",
    bgWhite: "偵測為白底，保留原圖髮絲細節",
    bgNotWhite: "偵測非白底，已自動去背並改為純白背景",
    exampleTitle: "合格大頭照範例",
    exampleError: "請將 example-qualified.jpg 放入 public 資料夾",
    placeholder: "請上傳照片以開始處理",
    disclaimerTitle: "重要聲明",
    disclaimer:
      "本系統僅提供照片裁切與背景處理輔助，下載照片不保證一定通過華測會審核，最終仍以官方審核為準。",
    hints: [
      "頭部／臉部約占畫面 80%",
      "只需要脖子以上",
      "背景須為純白色 #FFFFFF",
      "頭頂與下巴不可被切掉",
    ],
  },
};

function GuideLines() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${OUTPUT_WIDTH} ${OUTPUT_HEIGHT}`}
    >
      <line
        x1="0"
        y1={TARGET_TOP_Y}
        x2={OUTPUT_WIDTH}
        y2={TARGET_TOP_Y}
        stroke="red"
        strokeWidth="2"
        strokeDasharray="6 6"
        opacity="0.75"
      />
      <line
        x1="0"
        y1={TARGET_CHIN_Y}
        x2={OUTPUT_WIDTH}
        y2={TARGET_CHIN_Y}
        stroke="red"
        strokeWidth="2"
        strokeDasharray="6 6"
        opacity="0.75"
      />
      <line
        x1={OUTPUT_WIDTH / 2}
        y1="0"
        x2={OUTPUT_WIDTH / 2}
        y2={OUTPUT_HEIGHT}
        stroke="red"
        strokeWidth="1"
        opacity="0.35"
      />
    </svg>
  );
}

export default function App() {
  const t = i18n.zh;

  const [passport, setPassport] = useState("");
  const [userName, setUserName] = useState("");
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [bgStatusText, setBgStatusText] = useState("");
  const [error, setError] = useState("");

  const [scaleValue, setScaleValue] = useState(1);
  const [moveXValue, setMoveXValue] = useState(0);
  const [moveYValue, setMoveYValue] = useState(0);

  const previewCanvasRef = useRef(null);
  const sourceImageRef = useRef(null);
  const drawableImageRef = useRef(null);
  const segmentationRef = useRef(null);
  const rafRef = useRef(null);

  const manualRef = useRef({
    scale: 1,
    moveX: 0,
    moveY: 0,
  });

  useEffect(() => {
    try {
      const model = new SelfieSegmentation({
        locateFile: (file) => `${MEDIAPIPE_PATH}${file}`,
      });

      model.setOptions({
        modelSelection: 1,
      });

      model.onResults((results) => {
        const img = sourceImageRef.current;
        if (!img) return;

        const offCanvas = document.createElement("canvas");
        offCanvas.width = img.width;
        offCanvas.height = img.height;

        const ctx = offCanvas.getContext("2d");
        ctx.clearRect(0, 0, offCanvas.width, offCanvas.height);

        ctx.drawImage(results.segmentationMask, 0, 0, img.width, img.height);
        ctx.globalCompositeOperation = "source-in";
        ctx.drawImage(img, 0, 0, img.width, img.height);

        drawableImageRef.current = offCanvas;
        setHasImage(true);
        setIsProcessing(false);
        scheduleDraw();
      });

      segmentationRef.current = model;
      setIsModelLoaded(true);
    } catch (err) {
      console.error(err);
      setError("MediaPipe 初始化失敗，請確認 public/mediapipe/ 檔案是否已放入。");
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function isNearWhiteBackground(img) {
    const sampleCanvas = document.createElement("canvas");
    const size = 80;
    sampleCanvas.width = size;
    sampleCanvas.height = size;

    const ctx = sampleCanvas.getContext("2d");
    ctx.drawImage(img, 0, 0, size, size);

    const data = ctx.getImageData(0, 0, size, size).data;
    let whiteCount = 0;
    let total = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isEdge = x < 10 || x > size - 11 || y < 10 || y > size - 11;

        if (isEdge) {
          const i = (y * size + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (r > 235 && g > 235 && b > 235) {
            whiteCount++;
          }

          total++;
        }
      }
    }

    return whiteCount / total > 0.85;
  }

  function draw() {
    const canvas = previewCanvasRef.current;
    const img = drawableImageRef.current || sourceImageRef.current;

    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    const { scale, moveX, moveY } = manualRef.current;

    ctx.clearRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    const baseScale = Math.min(
      OUTPUT_WIDTH / img.width,
      OUTPUT_HEIGHT / img.height
    );

    const finalScale = baseScale * scale;
    const drawW = img.width * finalScale;
    const drawH = img.height * finalScale;

    const x = (OUTPUT_WIDTH - drawW) / 2 + moveX;
    const y = (OUTPUT_HEIGHT - drawH) / 2 + moveY;

    ctx.drawImage(img, x, y, drawW, drawH);
  }

  function scheduleDraw() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      draw();
      rafRef.current = null;
    });
  }

  function resetSliders() {
    manualRef.current = {
      scale: 1,
      moveX: 0,
      moveY: 0,
    };

    setScaleValue(1);
    setMoveXValue(0);
    setMoveYValue(0);
  }

  function handleSliderChange(key, value) {
    const numberValue = parseFloat(value);
    manualRef.current[key] = numberValue;

    if (key === "scale") setScaleValue(numberValue);
    if (key === "moveX") setMoveXValue(numberValue);
    if (key === "moveY") setMoveYValue(numberValue);

    scheduleDraw();
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setIsProcessing(true);
    setHasImage(false);
    setBgStatusText("");
    resetSliders();

    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = async () => {
        sourceImageRef.current = img;

        const isWhite = isNearWhiteBackground(img);

        if (isWhite) {
          drawableImageRef.current = img;
          setBgStatusText(t.bgWhite);
          setHasImage(true);
          setIsProcessing(false);
          scheduleDraw();
          return;
        }

        setBgStatusText(t.bgNotWhite);

        try {
          if (!segmentationRef.current) {
            drawableImageRef.current = img;
            setHasImage(true);
            setIsProcessing(false);
            scheduleDraw();
            return;
          }

          await segmentationRef.current.send({ image: img });
        } catch (err) {
          console.error(err);
          setError("去背失敗，請改用白牆或白底照片。");
          drawableImageRef.current = img;
          setHasImage(true);
          setIsProcessing(false);
          scheduleDraw();
        }
      };

      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  }

  function handleDownload() {
    const canvas = previewCanvasRef.current;
    if (!canvas || !hasImage) return;

    draw();

    const cleanPassport = (passport || "Passport").replace(/[<>:"/\\|?*]/g, "");
    const cleanName = (userName || "Name").replace(/[<>:"/\\|?*]/g, "");

    const link = document.createElement("a");
    link.download = `${cleanPassport}_${cleanName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-2xl font-bold text-blue-900">{t.title}</h1>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="bg-white p-6 rounded-2xl shadow-md space-y-6 h-fit">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600">
              {t.passport}
            </label>
            <input
              type="text"
              value={passport}
              onChange={(e) => setPassport(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: A123456789"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600">
              {t.name}
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: WANG XIAO MING"
            />
          </div>

          <div className="pt-4 border-t">
            {!isModelLoaded ? (
              <div className="text-blue-600 animate-pulse font-medium text-center">
                {t.initModel}
              </div>
            ) : (
              <label className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-4 rounded-xl cursor-pointer transition shadow-lg font-bold">
                {isProcessing ? t.processing : t.upload}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                />
              </label>
            )}
          </div>

          {hasImage && (
            <div className="space-y-6 pt-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm">
                <span className="font-bold text-blue-800">
                  {t.bgStatus}:{" "}
                </span>
                {bgStatusText}
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>{t.zoom}</span>
                  <span className="text-blue-600">
                    {Math.round(scaleValue * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="5"
                  step="0.01"
                  value={scaleValue}
                  onChange={(e) => handleSliderChange("scale", e.target.value)}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>{t.moveX}</span>
                  <span>{Math.round(moveXValue)} px</span>
                </div>
                <input
                  type="range"
                  min="-400"
                  max="400"
                  step="1"
                  value={moveXValue}
                  onChange={(e) => handleSliderChange("moveX", e.target.value)}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-gray-500">
                  <span>{t.moveY}</span>
                  <span>{Math.round(moveYValue)} px</span>
                </div>
                <input
                  type="range"
                  min="-500"
                  max="500"
                  step="1"
                  value={moveYValue}
                  onChange={(e) => handleSliderChange("moveY", e.target.value)}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center">
          <div className="relative bg-white shadow-2xl border border-gray-200 overflow-hidden rounded-sm w-full max-w-[360px] aspect-[3/4]">
            <canvas
              ref={previewCanvasRef}
              width={OUTPUT_WIDTH}
              height={OUTPUT_HEIGHT}
              className="w-full h-full block bg-white"
            />

            {hasImage && <GuideLines />}

            {!hasImage && !isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-300 italic p-12 text-center">
                {t.placeholder}
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-20">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-blue-600 font-bold">{t.processing}</p>
              </div>
            )}
          </div>

          <button
            onClick={handleDownload}
            disabled={!hasImage}
            className={`mt-8 w-full max-w-[360px] py-4 rounded-xl text-white font-bold text-lg shadow-lg transition ${
              hasImage
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {t.download}
          </button>

          <div className="mt-4 max-w-[360px] p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <p className="font-bold mb-1">{t.disclaimerTitle}</p>
            {t.disclaimer}
          </div>

          <div className="mt-6 text-center">
            <div className="inline-block px-4 py-1 rounded-full bg-gradient-to-r from-indigo-100 to-purple-100 text-[11px] text-indigo-400 tracking-[0.2em] uppercase font-semibold shadow-sm">
              Rita H × AI Collaboration
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-md space-y-6 h-fit">
          <h3 className="text-lg font-bold text-gray-700 border-b pb-2">
            {t.exampleTitle}
          </h3>

          <div className="relative border bg-gray-50 rounded overflow-hidden aspect-[3/4]">
            <img
              src={EXAMPLE_SRC}
              alt="Qualified Example"
              className="w-full h-full object-cover block"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const next = e.currentTarget.nextElementSibling;
                if (next) next.style.display = "flex";
              }}
            />

            <div className="hidden absolute inset-0 bg-gray-100 flex-col items-center justify-center text-center p-6 text-xs text-red-500 font-medium">
              {t.exampleError}
            </div>

            <GuideLines />
          </div>

          <ul className="space-y-2">
            {t.hints.map((hint, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-600"
              >
                <span className="text-green-500 font-bold">✓</span>
                {hint}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="max-w-7xl mx-auto mt-12 text-center text-gray-400 text-[10px] uppercase tracking-widest">
        Local Browser Execution Only
      </footer>
    </div>
  );
}