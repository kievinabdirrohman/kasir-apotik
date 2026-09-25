import { buildAuditPdfDefinition, type AuditExportModel } from './reportExport';

async function imageToDataUrl(source?: string): Promise<string | undefined> {
  if (!source) return undefined;
  if (source.startsWith('data:')) return source;

  try {
    const response = await fetch(source);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

export async function downloadAuditPdf(model: AuditExportModel, logoSource?: string): Promise<void> {
  const [pdfModule, fontModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  const pdfMake = (pdfModule as { default?: typeof import('pdfmake') }).default || pdfModule;
  const fontData = (fontModule as { default?: Record<string, unknown> }).default || fontModule;

  if (typeof pdfMake.addVirtualFileSystem === 'function') {
    pdfMake.addVirtualFileSystem((fontData as { vfs?: Record<string, string> }).vfs || fontData as Record<string, string>);
  }

  const logoDataUrl = await imageToDataUrl(logoSource);
  await pdfMake.createPdf(buildAuditPdfDefinition({ ...model, logoDataUrl })).download(model.fileName);
}
