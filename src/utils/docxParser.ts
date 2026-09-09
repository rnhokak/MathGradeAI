import JSZip from 'jszip';

export interface ExtractedDocxContent {
  text: string;
  images: Array<{
    fileName: string;
    mimeType: string;
    dataUrl: string;
    base64: string;
  }>;
  tables: string[][][];
}

/**
 * Extracts raw TeX string from MathType OLE binary (.bin)
 */
function extractTexFromOleBinary(buf: Buffer | Uint8Array): string | null {
  const str = Buffer.from(buf).toString('latin1');
  const marker = 'TeX Input Language\u0000';
  const idx = str.indexOf(marker);
  if (idx !== -1) {
    const start = idx + marker.length;
    const end = str.indexOf('\u0000', start);
    if (end !== -1) {
      return str.substring(start, end).trim();
    }
    return str.substring(start, start + 300).trim();
  }
  return null;
}

/**
 * Parses an OMML math node or math XML into readable LaTeX / text
 */
function cleanMathXml(mathXml: string): string {
  // Extract all text content from <m:t> and <w:t> tags
  const pieces: string[] = [];
  const regex = /<[m|w]:t[^>]*>([^<]*)<\/[m|w]:t>/g;
  let match;
  while ((match = regex.exec(mathXml)) !== null) {
    pieces.push(match[1]);
  }

  if (pieces.length > 0) {
    return pieces.join('');
  }

  // Fallback: strip tags
  return mathXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extracts text, math formulas (OMML & MathType), tables, and images from a docx buffer
 */
export async function parseDocx(buffer: ArrayBuffer | Buffer): Promise<ExtractedDocxContent> {
  const zip = await JSZip.loadAsync(buffer);
  const images: ExtractedDocxContent['images'] = [];
  const tables: string[][][] = [];
  let fullText = '';

  // 1. Extract Images from word/media/
  const mediaFiles = Object.keys(zip.files).filter(
    (fileName) => fileName.startsWith('word/media/') && !zip.files[fileName].dir
  );

  for (const mediaPath of mediaFiles) {
    const file = zip.files[mediaPath];
    const ext = mediaPath.split('.').pop()?.toLowerCase();

    // Only process raster images suitable for vision LLMs
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext || '')) {
      const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      const base64 = await file.async('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      images.push({
        fileName: mediaPath.replace('word/media/', ''),
        mimeType,
        dataUrl,
        base64,
      });
    }
  }

  // 2. Map MathType OLE objects from word/_rels/document.xml.rels
  const oleTexByRId: Record<string, string> = {};
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    try {
      const relsXml = await relsFile.async('string');
      // Match all Relationship elements
      const relRegex = /<Relationship[^>]+Id=["']([^"']+)["'][^>]+Target=["']([^"']+)["']/g;
      let relMatch;
      while ((relMatch = relRegex.exec(relsXml)) !== null) {
        const rId = relMatch[1];
        const target = relMatch[2];
        if (target.includes('oleObject')) {
          const targetPath = target.startsWith('embeddings/')
            ? `word/${target}`
            : target.startsWith('../')
            ? target.replace('../', '')
            : `word/${target}`;
          
          const oleZipFile = zip.file(targetPath);
          if (oleZipFile) {
            const oleBuf = await oleZipFile.async('nodebuffer');
            const tex = extractTexFromOleBinary(oleBuf);
            if (tex) {
              oleTexByRId[rId] = tex;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not parse OLE relationships:', e);
    }
  }

  // 3. Extract Document Content from word/document.xml
  const docFile = zip.file('word/document.xml');
  if (docFile) {
    let xml = await docFile.async('string');

    // Replace MathType OLE equations with their LaTeX representations
    xml = xml.replace(/<w:object[\s\S]*?<\/w:object>/g, (objBlock) => {
      const oleMatch = objBlock.match(/<o:OLEObject[\s\S]*?r:id=["']([^"']+)["']/);
      const rId = oleMatch ? oleMatch[1] : null;
      if (rId && oleTexByRId[rId]) {
        return ` $${oleTexByRId[rId]}$ `;
      }
      return ' ';
    });

    // Also check for standalone OLEObject tags
    xml = xml.replace(/<o:OLEObject[\s\S]*?r:id=["']([^"']+)["'][\s\S]*?\/>/g, (_, rId) => {
      if (oleTexByRId[rId]) {
        return ` $${oleTexByRId[rId]}$ `;
      }
      return ' ';
    });

    // Extract Tables
    const trMatches = xml.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) || [];
    if (trMatches.length > 0) {
      let currentTable: string[][] = [];
      for (const tr of trMatches) {
        const rowCells: string[] = [];
        const tcMatches = tr.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/g) || [];
        for (const tc of tcMatches) {
          // Extract text and OMML math from cell
          let cellText = tc
            .replace(/<m:oMath[\s>][\s\S]*?<\/m:oMath>/g, (mathNode) => ` ${cleanMathXml(mathNode)} `)
            .replace(/<w:p[^>]*>/g, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          rowCells.push(cellText);
        }
        if (rowCells.length > 0) {
          currentTable.push(rowCells);
        }
      }
      if (currentTable.length > 0) {
        tables.push(currentTable);
      }
    }

    // Extract general text and paragraphs
    const paragraphs = xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];
    const textLines: string[] = [];

    for (const p of paragraphs) {
      let pText = p
        .replace(/<m:oMath[\s>][\s\S]*?<\/m:oMath>/g, (mathNode) => ` ${cleanMathXml(mathNode)} `)
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (pText) {
        textLines.push(pText);
      }
    }

    fullText = textLines.join('\n');
  }

  return {
    text: fullText,
    images,
    tables,
  };
}
