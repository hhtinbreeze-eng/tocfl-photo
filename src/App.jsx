import React, { useEffect, useRef, useState } from "react";

const OUTPUT_WIDTH = 600;
const OUTPUT_HEIGHT = 800;

const EXAMPLE_SRC = `${import.meta.env.BASE_URL}example-qualified.jpg`;
const MEDIAPIPE_PATH = `${import.meta.env.BASE_URL}mediapipe/`;

export default function App() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [hasImage, setHasImage] = useState(false);

  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = `${MEDIAPIPE_PATH}selfie_segmentation.js`;

    script.onload = () => {
      if (window.SelfieSegmentation) {
        setIsModelLoaded(true);
      }
    };

    document.body.appendChild(script);
  }, []);

  function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        draw(img);
        setHasImage(true);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function draw(img) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    const scale = Math.min(
      OUTPUT_WIDTH / img.width,
      OUTPUT_HEIGHT / img.height
    );

    const w = img.width * scale;
    const h = img.height * scale;

    const x = (OUTPUT_WIDTH - w) / 2;
    const y = (OUTPUT_HEIGHT - h) / 2;

    ctx.drawImage(img, x, y, w, h);
  }

  function download() {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = "photo.png";
    link.href = canvas.toDataURL();
    link.click();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold text-blue-900 mb-8">
        華測會大頭照處理系統
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* 左：表單 */}
        <div className="bg-white p-6 rounded-xl shadow">
          <input
            placeholder="護照號碼"
            className="w-full mb-3 p-2 border rounded"
          />
          <input
            placeholder="姓名"
            className="w-full mb-4 p-2 border rounded"
          />

          {!isModelLoaded ? (
            <p className="text-blue-500">正在初始化模型...</p>
          ) : (
            <label className="block bg-blue-600 text-white text-center py-3 rounded cursor-pointer">
              上傳照片
              <input
                type="file"
                className="hidden"
                onChange={handleUpload}
              />
            </label>
          )}
        </div>

        {/* ⭐ 中間：範例（重點） */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-bold mb-3">合格大頭照範例</h3>

          <div className="relative">
            <img
              src={EXAMPLE_SRC}
              className="w-full rounded"
            />
          </div>

          <ul className="mt-4 text-sm space-y-1">
            <li>✓ 頭部約占畫面 80%</li>
            <li>✓ 只需脖子以上</li>
            <li>✓ 純白背景</li>
            <li>✓ 不可裁切頭頂與下巴</li>
          </ul>
        </div>

        {/* ⭐ 右邊：使用者裁切 */}
        <div className="flex flex-col items-center">
          <canvas
            ref={canvasRef}
            width={OUTPUT_WIDTH}
            height={OUTPUT_HEIGHT}
            className="bg-white border shadow rounded"
          />

          <button
            onClick={download}
            disabled={!hasImage}
            className={`mt-6 px-6 py-3 rounded text-white ${
              hasImage ? "bg-green-600" : "bg-gray-400"
            }`}
          >
            下載成品照片
          </button>

          <div className="mt-6 text-xs text-gray-400">
            Rita H × AI Collaboration
          </div>
        </div>
      </div>
    </div>
  );
}