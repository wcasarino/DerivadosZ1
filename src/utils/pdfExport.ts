import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
  backgroundColor = '#f8fafc'
): Promise<void> {
  const scrollNodes = Array.from(
    element.querySelectorAll<HTMLElement>('[data-pdf-scroll="true"]')
  );

  const savedScrollStyles = scrollNodes.map((node) => ({
    node,
    overflowX: node.style.overflowX,
    overflow: node.style.overflow,
  }));

  const savedElWidth = element.style.width;
  const savedElMinWidth = element.style.minWidth;

  try {
    let requiredWidth = element.clientWidth;

    for (const node of scrollNodes) {
      if (node.scrollWidth + 48 > requiredWidth) {
        requiredWidth = node.scrollWidth + 48;
      }
      node.style.overflowX = 'visible';
      node.style.overflow = 'visible';
    }

    if (requiredWidth > element.clientWidth) {
      element.style.width = `${requiredWidth}px`;
      element.style.minWidth = `${requiredWidth}px`;
    }

    const filter = (node: Node) => {
      if (node instanceof HTMLElement && node.dataset.pdfIgnore === 'true') {
        return false;
      }
      return true;
    };

    let dataUrl: string;
    try {
      dataUrl = await toPng(element, {
        pixelRatio: 2,
        backgroundColor,
        cacheBust: true,
        filter,
      });
    } catch {
      dataUrl = await toPng(element, {
        pixelRatio: 2,
        backgroundColor,
        skipFonts: true,
        filter,
      });
    }

    const img = await loadImage(dataUrl);
    const pageWidthMm = 297;
    const marginMm = 8;
    const contentWidthMm = pageWidthMm - marginMm * 2;
    const contentHeightMm =
      contentWidthMm * (img.naturalHeight / img.naturalWidth);
    const pageHeightMm = Math.max(210, Math.ceil(contentHeightMm + marginMm * 2));
    const orientation =
      pageWidthMm >= pageHeightMm ? 'landscape' : 'portrait';

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [pageWidthMm, pageHeightMm],
    });

    pdf.addImage(
      dataUrl,
      'PNG',
      marginMm,
      marginMm,
      contentWidthMm,
      contentHeightMm
    );

    const safeName = filename.toLowerCase().endsWith('.pdf')
      ? filename
      : `${filename}.pdf`;
    pdf.save(safeName);
  } finally {
    element.style.width = savedElWidth;
    element.style.minWidth = savedElMinWidth;
    for (const saved of savedScrollStyles) {
      saved.node.style.overflowX = saved.overflowX;
      saved.node.style.overflow = saved.overflow;
    }
  }
}
