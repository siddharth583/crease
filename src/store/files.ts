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

/** Downloads a file the browser made, under its name. */
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** A4 less 12mm either side, in CSS pixels: the width the report is laid out at on the page. */
const PAGE_WIDTH = 703;
const REPORT_FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Inter:wght@400;500;600;700;800&display=swap';

/**
 * The report's styles, scoped to the box it's drawn in: the PDF maker draws it inside the app's own page, where the
 * report's rules for the page itself (and for tables, headings…) mustn't touch the app. Screen-only padding and the
 * print page size are left out: the PDF sets its own margins.
 */
function scopedStyles(doc: Document, scope: string): string {
  const prefix = (list: string) =>
    list
      .split(',')
      .map((sel) => {
        const t = sel.trim();
        if (/^(html|body|:root)$/.test(t)) return scope;
        return `${scope} ${t.replace(/^(html|body|:root)\s+/, '')}`;
      })
      .join(', ');
  const rules = (list: CSSRuleList): string =>
    [...list]
      .map((rule) => {
        if (rule.type === 1) return `${prefix((rule as CSSStyleRule).selectorText)} { ${(rule as CSSStyleRule).style.cssText} }`;
        if (rule.type === 4) {
          const media = (rule as CSSMediaRule).media.mediaText;
          if (media.includes('print')) return rules((rule as CSSMediaRule).cssRules);
          return media.includes('screen') ? '' : `@media ${media} { ${rules((rule as CSSMediaRule).cssRules)} }`;
        }
        return rule.type === 6 ? '' : rule.cssText;
      })
      .join('\n');
  return [...doc.styleSheets]
    .map((sheet) => {
      try {
        return rules(sheet.cssRules);
      } catch {
        return ''; // the font sheet from Google can't be read here; the app's page loads it instead
      }
    })
    .join('\n');
}

/**
 * The report laid out for drawing on the app's own page: its content in a box of the page's width, with its styles
 * scoped to that box, and its fonts loaded.
 */
async function reportBox(html: string, width = PAGE_WIDTH, background = '#fff'): Promise<HTMLDivElement> {
  // Read the report's styles and content from a frame of its own.
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: `${width}px`, height: '100px', border: '0' });
  document.body.appendChild(frame);
  const box = document.createElement('div');
  try {
    const doc = frame.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    box.className = 'crease-pdf';
    Object.assign(box.style, { width: `${width}px`, background });
    box.innerHTML = `<style>${scopedStyles(doc, '.crease-pdf')}</style>${doc.body.innerHTML}`;
  } finally {
    frame.remove();
  }
  // The report's fonts, on the app's page where it's drawn.
  if (!document.getElementById('crease-pdf-fonts')) {
    const link = document.createElement('link');
    link.id = 'crease-pdf-fonts';
    link.rel = 'stylesheet';
    link.href = REPORT_FONTS;
    document.head.appendChild(link);
    await new Promise((r) => {
      link.onload = r;
      link.onerror = r;
      setTimeout(r, 3000);
    });
  }
  await Promise.all(
    ['500 12px Inter', '700 12px Inter', '800 12px Inter', '700 12px "Bricolage Grotesque"', '800 12px "Bricolage Grotesque"'].map((f) => document.fonts.load(f).catch(() => null)),
  );
  return box;
}

/**
 * Turns an HTML report into a PDF file and saves it: shared on phones with the app, downloaded straight away on the
 * web. On the web the report is laid out off screen and drawn into A4 pages; the PDF maker only loads when needed.
 */
export async function savePdf(name: string, html: string): Promise<SaveResult> {
  if (Platform.OS === 'web') {
    const box = await reportBox(html);
    const { default: html2pdf } = await import('html2pdf.js');
    // `pagebreak` is the library's page-break plugin; its type file leaves it out.
    const options = {
      margin: [12, 12, 14, 12] as [number, number, number, number],
      filename: name,
      image: { type: 'jpeg' as const, quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'h2', 'h3', '.b-row', '.tile', 'svg', '.avoid-break'] },
    };
    const blob: Blob = await html2pdf().set(options).from(box).outputPdf('blob');
    download(blob, name);
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

/** Phones' browsers refuse canvases past about 16 million pixels, so a long report is drawn a little smaller. */
const MAX_PIXELS = 16_000_000;

/**
 * Saves an HTML report as one PNG picture, the whole report top to bottom, downloaded under its name. Web only: the
 * phone app shares its PDF instead.
 */
/**
 * A report as a picture. `width`, `background` and `padding` let a picture made for phones (the line-up) be narrow and
 * dark; on the web it goes to the phone's share sheet where there is one, and downloads otherwise.
 */
export async function saveReportImage(
  name: string,
  html: string,
  { width = PAGE_WIDTH, background = '#ffffff', padding = 24, share = false }: { width?: number; background?: string; padding?: number; share?: boolean } = {},
): Promise<SaveResult> {
  if (Platform.OS !== 'web') return savePdf(name.replace(/\.png$/i, '.pdf'), html);
  const box = await reportBox(html, width, background);
  box.style.padding = `${padding}px`;
  box.style.boxSizing = 'content-box';
  const holder = document.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  Object.assign(holder.style, { position: 'fixed', left: '-10000px', top: '0' });
  holder.appendChild(box);
  document.body.appendChild(holder);
  try {
    const { default: html2canvas } = await import('html2canvas-pro');
    const area = box.offsetWidth * box.offsetHeight;
    const scale = Math.min(2, Math.sqrt(MAX_PIXELS / Math.max(area, 1)));
    const canvas = await html2canvas(box, { scale, backgroundColor: background, useCORS: true });
    const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('No picture'))), 'image/png'));
    if (share) {
      const file = new globalThis.File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return 'shared';
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
          // The share sheet can refuse (the tap was too long ago): download it instead.
        }
      }
    }
    download(blob, name);
    return 'downloaded';
  } finally {
    holder.remove();
  }
}

/** Shares a picture (a PNG file on phones, a data: URI on the web), or downloads it where sharing isn't possible. */
export async function shareImage(uri: string, name: string): Promise<SaveResult> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const file = new globalThis.File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return 'shared';
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      }
    }
    const a = document.createElement('a');
    a.href = uri;
    a.download = name;
    a.click();
    return 'downloaded';
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this phone.');
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share the result' });
  return 'shared';
}
