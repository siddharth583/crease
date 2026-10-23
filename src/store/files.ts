import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/** Hands a text file to the phone's share sheet (WhatsApp, Files, email…), or downloads it where there is none. */
export async function saveTextFile(name: string, text: string): Promise<SaveResult> {
  if (Platform.OS === 'web') {
    const blob = new Blob([text], { type: 'application/json' });
    const file = new globalThis.File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return 'shared';
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
        // Some browsers refuse the share after all; a download still works.
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }

  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(text);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this phone.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Share match file' });
  return 'shared';
}

/** Lets the person pick a file and returns its text, or null if they backed out. */
export async function pickTextFile(): Promise<string | null> {
  // Files saved from WhatsApp or email don't always keep a JSON type, so accept anything and check the contents.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (Platform.OS === 'web' && asset.file) return asset.file.text();
  return new File(asset.uri).text();
}

/**
 * Turns an HTML report into a PDF and shares it. On the web there's no PDF engine, so the report opens in the
 * print dialog, where "Save as PDF" is one of the printers.
 */
export async function savePdf(name: string, html: string): Promise<SaveResult> {
  if (Platform.OS === 'web') {
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.setAttribute('aria-hidden', 'true');
    document.body.appendChild(frame);
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    // Let the fonts load, then print; the frame goes once the dialog closes.
    await new Promise((r) => setTimeout(r, 600));
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(() => frame.remove(), 60_000);
    return 'downloaded';
  }

  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842, margins: { left: 36, right: 36, top: 36, bottom: 36 } });
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  await new File(uri).move(file);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this phone.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share scorecard' });
  return 'shared';
}
