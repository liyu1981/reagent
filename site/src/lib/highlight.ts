import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';

// Only the languages the docs and demos actually use, to keep the bundle small.
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);

const LANGUAGE_ALIASES: Record<string, string> = {
  tsx: 'typescript',
  jsx: 'javascript',
  sh: 'bash',
  shell: 'bash',
  jsonc: 'json',
  html: 'xml',
};

/** Highlight `code` to HTML, falling back to auto-detection. */
export function highlightCode(code: string, language?: string): string {
  const lang = language === undefined ? undefined : (LANGUAGE_ALIASES[language] ?? language);
  if (lang !== undefined && hljs.getLanguage(lang)) {
    return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
  }
  return hljs.highlightAuto(code).value;
}
