'use client';

import React, { useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
  text?: string | null;
  className?: string;
  style?: React.CSSProperties;
  as?: 'div' | 'span' | 'p';
  inline?: boolean;
}

/**
 * Renders text containing LaTeX math expressions ($inline$, $$display$$, \(inline\), \[display\])
 * using KaTeX with robust error recovery and beautiful typography.
 */
export const MathRenderer: React.FC<MathRendererProps> = ({
  text,
  className = '',
  style = {},
  as = 'div',
  inline = false,
}) => {
  const renderedHtml = useMemo(() => {
    if (!text || typeof text !== 'string') return '';

    const blockPlaceholders: string[] = [];
    const inlinePlaceholders: string[] = [];

    const katexCommonOptions = {
      throwOnError: false,
      errorColor: '#f59e0b',
      strict: false,
      trust: true,
      macros: {
        '\\geqslant': '\\ge',
        '\\leqslant': '\\le',
      },
    };

    let processedText = text;

    // 1. Extract Display / Block Math: $$ ... $$, \[ ... \], and standard LaTeX environments
    const renderBlockMath = (math: string) => {
      const trimmed = math.trim();
      try {
        const html = katex.renderToString(trimmed, {
          ...katexCommonOptions,
          displayMode: true,
        });
        const ph = `___KATEX_BLOCK_${blockPlaceholders.length}___`;
        blockPlaceholders.push(`<div class="math-block-wrapper my-2 overflow-x-auto">${html}</div>`);
        return ph;
      } catch {
        const ph = `___KATEX_BLOCK_${blockPlaceholders.length}___`;
        const escaped = trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        blockPlaceholders.push(`<pre class="math-fallback p-2 bg-slate-800 text-amber-300 rounded text-sm">${escaped}</pre>`);
        return ph;
      }
    };

    // Replace $$ ... $$
    processedText = processedText.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => renderBlockMath(math));

    // Replace \[ ... \]
    processedText = processedText.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => renderBlockMath(math));

    // Replace raw \begin{...}...\end{...} environments not already wrapped in $$
    processedText = processedText.replace(
      /\\begin\{(equation|aligned|cases|matrix|pmatrix|bmatrix|vmatrix|alignedat|split)\}([\s\S]+?)\\end\{\1\}/g,
      (fullMatch) => renderBlockMath(fullMatch)
    );

    // 2. Extract Inline Math: $ ... $ and \( ... \)
    const renderInlineMath = (math: string) => {
      const trimmed = math.trim();
      try {
        const html = katex.renderToString(trimmed, {
          ...katexCommonOptions,
          displayMode: false,
        });
        const ph = `___KATEX_INLINE_${inlinePlaceholders.length}___`;
        inlinePlaceholders.push(`<span class="math-inline-wrapper">${html}</span>`);
        return ph;
      } catch {
        const ph = `___KATEX_INLINE_${inlinePlaceholders.length}___`;
        const escaped = trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        inlinePlaceholders.push(`<code class="math-inline-fallback text-amber-300">$${escaped}$</code>`);
        return ph;
      }
    };

    // Replace \( ... \)
    processedText = processedText.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => renderInlineMath(math));

    // Replace $ ... $ (ignoring escaped \$)
    processedText = processedText.replace(/(?<!\\)\$([^\$\n]+?)(?<!\\)\$/g, (_, math) => renderInlineMath(math));

    // 3. Escape basic HTML entities in remaining non-math text to prevent XSS
    let safeHtml = processedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 4. Format simple markdown elements: bold, italic, inline code, headings
    safeHtml = safeHtml
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-slate-800 text-indigo-300 rounded text-xs font-mono">$1</code>')
      .replace(/^### (.*$)/gim, '<h4 class="font-bold text-base mt-3 mb-1 text-slate-200">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 class="font-bold text-lg mt-3 mb-1 text-indigo-300">$1</h3>')
      .replace(/^# (.*$)/gim, '<h2 class="font-bold text-xl mt-4 mb-2 text-indigo-400">$1</h2>');

    if (inline) {
      safeHtml = safeHtml.replace(/\n/g, ' ');
    } else {
      safeHtml = safeHtml.replace(/\n/g, '<br/>');
    }

    // 5. Restore placeholders using replacer functions to avoid $ pattern substitution bugs
    blockPlaceholders.forEach((blockHtml, idx) => {
      safeHtml = safeHtml.replace(`___KATEX_BLOCK_${idx}___`, () => blockHtml);
    });

    inlinePlaceholders.forEach((inlineHtml, idx) => {
      safeHtml = safeHtml.replace(`___KATEX_INLINE_${idx}___`, () => inlineHtml);
    });

    return safeHtml;
  }, [text, inline]);

  const Tag = inline ? 'span' : as;

  return (
    <Tag
      className={`math-rendered-content ${inline ? 'math-inline' : ''} ${className}`}
      style={{
        lineHeight: inline ? 'inherit' : '1.7',
        wordBreak: 'break-word',
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};
