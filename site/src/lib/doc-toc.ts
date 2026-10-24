import { slugifyHeading } from './slug';

export interface DocHeading {
  id: string;
  text: string;
  depth: 2 | 3;
}

function headingText(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]/g, '')
    .trim();
}

/** Extract the H2/H3 outline from a markdown document, skipping code fences. */
export function docHeadings(content: string): DocHeading[] {
  const headings: DocHeading[] = [];
  let inFence = false;
  for (const line of content.split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match === null) {
      continue;
    }
    const text = headingText(match[2]);
    const id = slugifyHeading(text);
    if (text !== '' && id !== '') {
      headings.push({ id, text, depth: match[1].length === 2 ? 2 : 3 });
    }
  }
  return headings;
}
