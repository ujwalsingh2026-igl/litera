import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

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
 * Universally exports or shares files across:
 * 1. Android/iOS Capacitor APK (using Filesystem.writeFile with FileProvider and Share.share { files: [...] })
 * 2. Mobile web (using navigator.share with File if supported)
 * 3. Desktop web (using standard blob object URL / direct download)
 */
export async function exportManuscriptFile(options: ExportFileOptions): Promise<ExportResult> {
  const { filename, mimeType, content, title = 'Literia Manuscript' } = options;

  // 1. Native Capacitor Android / iOS App
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await toBase64(content);

      // Save a copy in Documents folder for easy offline file browsing if permitted
      try {
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
      } catch {
        // Documents folder write may require extra permissions on some Android versions, continue to Cache
      }

      // Write to Cache directory (guaranteed by FileProvider paths)
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      // CRITICAL FOR ANDROID:
      // Pass ONLY `files: [writeResult.uri]` so Capacitor SharePlugin triggers `shareFiles()`
      // with FileProvider content URI, EXTRA_STREAM, and FLAG_GRANT_READ_URI_PERMISSION.
      // Do NOT pass `text` or `url` which causes Android to treat it as plain text!
      await Share.share({
        title,
        files: [writeResult.uri],
        dialogTitle: `Save or Share ${filename}`,
      });

      return { success: true, method: 'capacitor-share' };
    } catch (err: any) {
      console.warn('Native Capacitor share failed, falling back:', err);
      // If user dismissed or cancelled the share dialog, consider it handled
      if (
        err?.message?.includes('canceled') ||
        err?.message?.includes('cancelled') ||
        err?.message?.includes('Share canceled')
      ) {
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
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 2000);

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
