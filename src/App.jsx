<div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

  {/* 左欄：表單（完全不動） */}
  <div className="bg-white p-6 rounded-2xl shadow-md space-y-6 h-fit">
    {/* ⭐ 保持你原本全部內容 */}
  </div>

  {/* ⭐ 中欄：範例（原本在右邊 → 移到中間） */}
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

  {/* ⭐ 右欄：裁切區（原本中間 → 移到右邊） */}
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

</div>