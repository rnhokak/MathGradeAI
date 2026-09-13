'use client';

import React, { useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders text containing LaTeX math expressions ($inline$ and $$display$$)
 * using KaTeX with robust error recovery.
 */
export const MathRenderer: React.FC<MathRendererProps> = ({
  text,
  className = '',
  style = {},
}) => {
  const renderedHtml = useMemo(() => {
    if (!text) return '';

    // First replace block display math $$ ... $$
    const blockPlaceholders: string[] = [];
    let processedText = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try {
        const html = katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
        });
        const ph = `___KATEX_BLOCK_${blockPlaceholders.length}___`;
        blockPlaceholders.push(`<div class="math-block-wrapper my-2 overflow-x-auto">${html}</div>`);
        return ph;
      } catch (err) {
        const ph = `___KATEX_BLOCK_${blockPlaceholders.length}___`;
        blockPlaceholders.push(`<pre class="math-fallback p-2 bg-slate-800 text-amber-300 rounded text-sm">${math}</pre>`);
        return ph;
      }
    });

    // Next replace inline math $ ... $ (avoiding escaped \$ or currency)
    const inlinePlaceholders: string[] = [];
    processedText = processedText.replace(/(?<!\\)\$([^\$\n]+?)(?<!\\)\$/g, (_, math) => {
      try {
        const html = katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
        });
        const ph = `___KATEX_INLINE_${inlinePlaceholders.length}___`;
        inlinePlaceholders.push(`<span class="math-inline-wrapper">${html}</span>`);
        return ph;
      } catch (err) {
        const ph = `___KATEX_INLINE_${inlinePlaceholders.length}___`;
        inlinePlaceholders.push(`<code class="math-inline-fallback text-amber-300">$${math}$</code>`);
        return ph;
      }
    });

    // Escape basic HTML entities in remaining text to prevent XSS
    let safeHtml = processedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Format simple markdown bold and italic
    safeHtml = safeHtml
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/^### (.*$)/gim, '<h4 class="font-bold text-base mt-3 mb-1 text-slate-200">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 class="font-bold text-lg mt-3 mb-1 text-indigo-300">$1</h3>')
      .replace(/^# (.*$)/gim, '<h2 class="font-bold text-xl mt-4 mb-2 text-indigo-400">$1</h2>')
      .replace(/\n/g, '<br/>');

    // Restore block math
    blockPlaceholders.forEach((blockHtml, idx) => {
      safeHtml = safeHtml.replace(`___KATEX_BLOCK_${idx}___`, blockHtml);
    });

    // Restore inline math
    inlinePlaceholders.forEach((inlineHtml, idx) => {
      safeHtml = safeHtml.replace(`___KATEX_INLINE_${idx}___`, inlineHtml);
    });

    return safeHtml;
  }, [text]);

  return (
    <div
      className={`math-rendered-content ${className}`}
      style={{
        lineHeight: '1.7',
        wordBreak: 'break-word',
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
