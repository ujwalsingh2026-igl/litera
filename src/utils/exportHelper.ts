import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { printManuscriptHtml } from './printManuscript';

export interface ExportFileOptions {
  filename: string;
  mimeType: string;
  content: string | Blob;
  title?: string;
}

export interface ExportResult {
  success: boolean;
  method: 'capacitor-share' | 'web-share' | 'download' | 'copy';
  error?: string;
}

/**
 * Converts Blob or string to base64 string
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
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(content);
  });
}

/**
 * Universally exports or shares files across:
 * 1. Android/iOS Capacitor APK (using Filesystem.writeFile + Share.share)
 * 2. Mobile web (using navigator.share with File if supported)
 * 3. Desktop web (using standard blob object URL / direct download)
 */
export async function exportManuscriptFile(options: ExportFileOptions): Promise<ExportResult> {
  const { filename, mimeType, content, title = 'Literia Manuscript' } = options;

  // 1. Native Capacitor Android / iOS App
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
        text: `Exported manuscript from Literia: ${filename}`,
        url: writeResult.uri,
        dialogTitle: `Export ${filename}`,
      });

      return { success: true, method: 'capacitor-share' };
    } catch (err: any) {
      console.warn('Native Capacitor share failed, trying fallback:', err);
      // If user dismissed share sheet, consider it handled
      if (err?.message?.includes('canceled') || err?.message?.includes('cancelled')) {
        return { success: true, method: 'capacitor-share' };
      }
    }
  }

  // 2. Mobile Web Share API with file attachment support
  const blob = typeof content === 'string' ? new Blob([content], { type: `${mimeType};charset=utf-8` }) : content;

  if (typeof navigator !== 'undefined' && typeof File !== 'undefined' && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text: `Literia Manuscript: ${filename}`,
          files: [file],
        });
        return { success: true, method: 'web-share' };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User cancelled share
        return { success: true, method: 'web-share' };
      }
      console.warn('Web share failed, trying browser download:', err);
    }
  }

  // 3. Desktop Web Browser Download via Object URL
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);

    return { success: true, method: 'download' };
  } catch (downloadErr: any) {
    console.error('Download failed:', downloadErr);
    return {
      success: false,
      method: 'download',
      error: downloadErr?.message || 'Failed to download file',
    };
  }
}

/**
 * Handles printing or native sharing of printable manuscript HTML on mobile and desktop
 */
export async function printOrShareManuscript(
  title: string,
  fullHtml: string
): Promise<ExportResult> {
  const filename = `${title.replace(/\s+/g, '_')}_Printable.html`;

  if (Capacitor.isNativePlatform()) {
    // In native app, write HTML file and invoke native Share Sheet so user can open in Chrome, print, or save to Drive/Files
    return exportManuscriptFile({
      filename,
      mimeType: 'text/html',
      content: fullHtml,
      title: `${title} (Printable / PDF)`,
    });
  }

  // On Web: invoke iframe print
  try {
    printManuscriptHtml(fullHtml);
    return { success: true, method: 'download' };
  } catch (err) {
    // Fallback to sharing the HTML file if print triggers an exception
    return exportManuscriptFile({
      filename,
      mimeType: 'text/html',
      content: fullHtml,
      title,
    });
  }
}
