import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../state';
import type { SignatureSettings, SignatureType, SignaturePlacement } from '../../types';
import { Modal, Button, Input } from '../ui';
import {
  PenTool,
  Type,
  Image as ImageIcon,
  Eraser,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface AuthorSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthorSignatureModal: React.FC<AuthorSignatureModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, updateSettings } = useApp();
  const sig = settings.signature || {
    enabled: true,
    type: 'typed',
    typedName: 'Author Signature',
    fontFamily: 'handwriting',
    placement: 'bottom',
    watermarkOpacity: 0.12,
    watermarkText: 'LITERIA MANUSCRIPT DRAFT',
  };

  const [sigType, setSigType] = useState<SignatureType>(sig.type);
  const [typedName, setTypedName] = useState(sig.typedName || 'Author Signature');
  const [fontFamily, setFontFamily] = useState<'handwriting' | 'serif' | 'classic'>(sig.fontFamily || 'handwriting');
  const [placement, setPlacement] = useState<SignaturePlacement>(sig.placement);
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(sig.watermarkOpacity || 0.12);
  const [watermarkText, setWatermarkText] = useState<string>(sig.watermarkText || 'CONFIDENTIAL DRAFT');
  const [drawnDataUrl, setDrawnDataUrl] = useState<string | undefined>(sig.drawnDataUrl);
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>(sig.imageDataUrl);

  // Canvas Drawing Pad State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSigType(sig.type);
      setTypedName(sig.typedName);
      setFontFamily(sig.fontFamily);
      setPlacement(sig.placement);
      setWatermarkOpacity(sig.watermarkOpacity);
      setWatermarkText(sig.watermarkText || 'CONFIDENTIAL DRAFT');
      setDrawnDataUrl(sig.drawnDataUrl);
      setImageDataUrl(sig.imageDataUrl);
    }
  }, [isOpen, sig]);

  // Canvas drawing handlers
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
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1c1917';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && canvasRef.current) {
      setIsDrawing(false);
      setDrawnDataUrl(canvasRef.current.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawnDataUrl(undefined);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageDataUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    const newSigSettings: SignatureSettings = {
      enabled: true,
      type: sigType,
      typedName: typedName.trim() || 'Author Signature',
      fontFamily,
      placement,
      watermarkOpacity,
      watermarkText: watermarkText.trim() || 'CONFIDENTIAL DRAFT',
      drawnDataUrl,
      imageDataUrl,
    };

    await updateSettings({
      signature: newSigSettings,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Author Signature & Watermark Studio" size="lg">
      <div className="space-y-5">
        {/* Signature Type Switcher */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
            Signature Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'typed', label: 'Calligraphic Typed', icon: <Type className="w-4 h-4" /> },
              { id: 'drawn', label: 'Draw Signature', icon: <PenTool className="w-4 h-4" /> },
              { id: 'image', label: 'Upload Signature Image', icon: <ImageIcon className="w-4 h-4" /> },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSigType(t.id as SignatureType)}
                className={cn(
                  'flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all',
                  sigType === t.id
                    ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 font-bold shadow-xs'
                    : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'
                )}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Signature Editor Area */}
        <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 space-y-3">
          {/* 1. TYPED */}
          {sigType === 'typed' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                    Pen Name / Signer Title
                  </label>
                  <Input
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="e.g. Evelyn Vance"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                    Calligraphic Font Style
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value as typeof fontFamily)}
                    className="w-full h-9 px-3 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 outline-none"
                  >
                    <option value="handwriting">Curvy Script (Caveat)</option>
                    <option value="serif">Literary Serif (Garamond)</option>
                    <option value="classic">Regal Classical (Cinzel)</option>
                  </select>
                </div>
              </div>

              {/* Signature Live Preview Box */}
              <div className="p-4 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center space-y-1">
                <div className="text-[10px] text-stone-400 font-mono uppercase tracking-wider">
                  Signature Preview
                </div>
                <div
                  className={cn(
                    'text-2xl pt-2 pb-1 text-stone-900 dark:text-stone-100',
                    fontFamily === 'handwriting' ? 'font-handwriting-literary' : fontFamily === 'classic' ? 'font-classic-literary' : 'font-serif-literary'
                  )}
                >
                  {typedName || 'Evelyn Vance'}
                </div>
                <div className="w-32 h-0.5 bg-stone-400 mx-auto rounded-full" />
              </div>
            </div>
          )}

          {/* 2. DRAWN */}
          {sigType === 'drawn' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                  Draw Signature Below (Mouse / Touch)
                </label>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-xs text-rose-500 hover:underline flex items-center gap-1"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Clear Pad</span>
                </button>
              </div>

              <div className="border border-stone-300 dark:border-stone-700 rounded-lg bg-white overflow-hidden shadow-inner flex justify-center">
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={130}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="cursor-crosshair w-full h-[130px]"
                />
              </div>
            </div>
          )}

          {/* 3. IMAGE */}
          {sigType === 'image' && (
            <div className="space-y-3">
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Upload Transparent Signature PNG / Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full text-xs text-stone-600 dark:text-stone-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500/10 file:text-amber-600 hover:file:bg-amber-500/20"
              />

              {imageDataUrl && (
                <div className="p-3 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center">
                  <img src={imageDataUrl} alt="Uploaded Signature" className="max-h-16 mx-auto object-contain" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Signature Placement & Watermark Options */}
        <div className="space-y-3 pt-1">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 font-mono">
            Export Placement & Watermark Options
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Signature Placement
              </label>
              <select
                value={placement}
                onChange={(e) => setPlacement(e.target.value as SignaturePlacement)}
                className="w-full h-9 px-3 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-stone-100 outline-none"
              >
                <option value="bottom">Bottom Footer Signature Line</option>
                <option value="watermark">Diagonal Background Watermark</option>
                <option value="both">Both (Bottom Line + Watermark)</option>
                <option value="none">Disabled (No Signature or Watermark)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Watermark Text
              </label>
              <Input
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="CONFIDENTIAL DRAFT"
              />
            </div>
          </div>

          {/* Watermark Opacity Slider */}
          {(placement === 'watermark' || placement === 'both') && (
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-stone-600 dark:text-stone-300">Watermark Opacity</span>
                <span className="font-mono font-medium">{Math.round(watermarkOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.40"
                step="0.01"
                value={watermarkOpacity}
                onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                className="w-full accent-amber-600"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Ready for PDF, Print & Document Export</span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleSave}>
              Save Signature Settings
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
