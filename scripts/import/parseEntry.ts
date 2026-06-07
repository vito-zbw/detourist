import { parse } from 'node-html-parser';
import { cleanText } from './text';

export interface ParsedEntry {
  photoFiles: string[];  // resource basenames in document order
  paragraphs: string[];  // cleaned narrative paragraphs, DAY N marker removed
}

const DAY_MARKER = /^day\s*\d+$/i;

export function parseEntryHtml(html: string): ParsedEntry {
  const root = parse(html);

  const photoFiles = root
    .querySelectorAll('.asset_image')
    .map((el) => el.getAttribute('src') ?? '')
    .filter(Boolean)
    .map((src) => src.split('/').pop() as string); // basename

  const paragraphs = root
    .querySelectorAll('.p2')
    .map((el) => cleanText(el.text))
    .filter((t) => t.length > 0)
    .filter((t, i) => !(i === 0 && DAY_MARKER.test(t)));

  return { photoFiles, paragraphs };
}
