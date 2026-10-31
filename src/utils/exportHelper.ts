import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface ExportFileOptions {
  filename: string;
  mimeType: string;
  content: string | Blob;
  title?: string;
  mode?: 'save' | 'share';
}

export interface ExportResult {
  success: boolean;
  method: 'download' | 'capacitor-save' | 'capacitor-share' | 'web-share' | 'copy';
  savedPath?: string;
  error?: string;
}

/**
 * Converts Blob or string to base64 string for Capacitor Filesystem
 */
async function toBase64(content: string | Blob): Promise<string> {
  if (typeof content === 'string') {
    // UTF-8 safe base64 encoding
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Strip data:*/*;base64, prefix
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(content);
  });
}

/**
 * Universally exports files:
 * 1. Mode 'save' (Default): Saves directly to the system (Desktop Downloads, Android Documents, Device Storage)
 * 2. Mode 'share': Opens native/web share sheet (WhatsApp, Drive, Email, etc.)
 */
export async function exportManuscriptFile(options: ExportFileOptions): Promise<ExportResult> {
  const { filename, mimeType, content, title = 'Literia Manuscript', mode = 'save' } = options;
  const blob = typeof content === 'string' ? new Blob([content], { type: `${mimeType};charset=utf-8` }) : content;

  // ==========================================
  // MODE 1: EXPLICIT SHARE REQUEST
  // ==========================================
  if (mode === 'share') {
    // 1a. Native Android / iOS Share Sheet
    if (Capacitor.isNativePlatform()) {
      try {
        const base64Data = await toBase64(content);
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        });

        await Share.share({
          title,
          files: [writeResult.uri],
          dialogTitle: `Share ${filename}`,
        });

        return { success: true, method: 'capacitor-share', savedPath: writeResult.uri };
      } catch (err: any) {
        if (
          err?.message?.includes('canceled') ||
          err?.message?.includes('cancelled') ||
          err?.message?.includes('Share canceled')
        ) {
          return { success: true, method: 'capacitor-share' };
        }
        console.warn('Native share failed, falling back to direct download:', err);
      }
    }

    // 1b. Mobile / Desktop Web Share API
    if (typeof navigator !== 'undefined' && typeof File !== 'undefined' && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: mimeType });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title,
            files: [file],
          });
          return { success: true, method: 'web-share' };
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return { success: true, method: 'web-share' };
        }
        console.warn('Web share failed, falling back to direct download:', err);
      }
    }
  }

  // ==========================================
  // MODE 2: SAVE DIRECTLY TO SYSTEM (DEFAULT)
  // ==========================================

  // 2a. Native Android / iOS Device Storage via Capacitor Filesystem
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await toBase64(content);
      let savedUri = '';

      // Primary target: Public Documents directory (accessible in device Files / Downloads app)
      try {
        const writeDoc = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
        savedUri = writeDoc.uri;
      } catch (docErr) {
        // Fallback: External Storage
        try {
          const writeExt = await Filesystem.writeFile({
            path: filename,
            data: base64Data,
            directory: Directory.ExternalStorage,
            recursive: true,
          });
          savedUri = writeExt.uri;
        } catch {
          // Fallback: App Cache
          const writeCache = await Filesystem.writeFile({
            path: filename,
            data: base64Data,
            directory: Directory.Cache,
            recursive: true,
          });
          savedUri = writeCache.uri;
        }
      }

      // Also trigger browser anchor download in WebView as extra download hook
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1500);
      } catch {}

      return {
        success: true,
        method: 'capacitor-save',
        savedPath: savedUri || filename,
      };
    } catch (nativeErr: any) {
      console.warn('Native Filesystem save failed, falling back to browser download:', nativeErr);
    }
  }

  // 2b. Standard Browser Direct System Download via Blob Object URL
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 2000);

    return { success: true, method: 'download' };
  } catch (downloadErr: any) {
    console.error('Direct system download failed:', downloadErr);
    return {
      success: false,
      method: 'download',
      error: downloadErr?.message || 'Failed to download file to system',
    };
  }
}
