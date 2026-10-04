import React, { useState, useRef, useEffect } from 'react';
import { Modal, Button } from '../ui';
import {
  Eraser,
  RotateCcw,
  Download,
  PlusCircle,
} from 'lucide-react';
import { useApp } from '../../state';
import { documentService } from '../../services/documentService';

interface DrawingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DrawingStudioModal: React.FC<DrawingStudioModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeDocument, openDocument } = useApp();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#1c1917');
  const [lineWidth, setLineWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveHistory();
      }
    }
  }, [isOpen]);

  const saveHistory = () => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL();
      setHistory((prev) => [...prev.slice(-10), dataUrl]);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isEraser ? '#ffffff' : strokeColor;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveHistory();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory();
  };

  const handleUndo = () => {
    if (history.length <= 1 || !canvasRef.current) return;
    const newHistory = [...history];
    newHistory.pop(); // Remove latest
    const prevDataUrl = newHistory[newHistory.length - 1];
    setHistory(newHistory);

    const img = new Image();
    img.src = prevDataUrl;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  };

  const handleDownloadImage = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `literia-sketch-${Date.now()}.png`;
    a.click();
  };

  const handleInsertIntoManuscript = async () => {
    if (!canvasRef.current || !activeDocument) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const updatedHtml = `${activeDocument.content || ''}<p><img src="${dataUrl}" alt="Manuscript Sketch" style="max-width:100%; margin:1.5rem auto; display:block;" /></p>`;
    await documentService.update(activeDocument.id, { content: updatedHtml });
    openDocument(activeDocument.id);
    onClose();
  };

  const palette = ['#1c1917', '#dc2626', '#d97706', '#16a34a', '#2563eb', '#9333ea', '#db2777'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Drawing & Illustration Studio" size="lg">
      <div className="space-y-4">
        {/* Drawing Controls Bar */}
        <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Colors */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500 font-medium">Color:</span>
            {palette.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setStrokeColor(c);
                  setIsEraser(false);
                }}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-full border border-stone-300 dark:border-stone-600 transition ${
                  strokeColor === c && !isEraser ? 'ring-2 ring-amber-500 scale-110' : 'hover:scale-105'
                }`}
              />
            ))}
          </div>

          {/* Stroke Width */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500 font-medium">Width:</span>
            {[2, 4, 8, 14].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setLineWidth(w)}
                className={`px-2 py-1 rounded-md border text-[11px] font-mono transition ${
                  lineWidth === w
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 font-bold'
                    : 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                {w}px
              </button>
            ))}
          </div>

          {/* Tools: Eraser & Clear & Undo */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEraser((prev) => !prev)}
              className={`p-1.5 rounded-lg border flex items-center gap-1 transition ${
                isEraser
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold'
                  : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <Eraser className="w-4 h-4" />
              <span>Eraser</span>
            </button>

            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              title="Undo stroke"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={clearCanvas}
              className="px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
            >
              Clear
            </button>
          </div>
        </div>

        {/* HTML5 Canvas Surface */}
        <div className="border border-stone-300 dark:border-stone-700 rounded-xl bg-white overflow-hidden shadow-inner flex justify-center">
          <canvas
            ref={canvasRef}
            width={620}
            height={340}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="cursor-crosshair w-full h-[340px] touch-none"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800">
          <button
            type="button"
            onClick={handleDownloadImage}
            className="text-xs text-stone-600 dark:text-stone-400 hover:underline flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-stone-500" />
            <span>Download PNG Sketch</span>
          </button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>

            {activeDocument && (
              <Button type="button" variant="primary" size="sm" onClick={handleInsertIntoManuscript}>
                <PlusCircle className="w-4 h-4 mr-1.5" />
                <span>Insert Sketch into Manuscript</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
