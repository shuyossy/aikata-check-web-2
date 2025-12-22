"use client";

import React, { memo, useState, useEffect } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

/**
 * コードブロックのコピーボタン付きラッパー
 */
function CodeBlock({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLPreElement>) {
  const [copied, setCopied] = useState(false);
  const codeRef = React.useRef<HTMLPreElement>(null);

  const handleCopy = async () => {
    if (codeRef.current) {
      const text = codeRef.current.textContent || "";
      await navigator.clipboard.writeText(text);
      setCopied(true);
    }
  };

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  return (
    <div className="relative group">
      <pre
        ref={codeRef}
        className={cn(
          "overflow-x-auto rounded-lg bg-gray-100 p-4 text-sm font-mono",
          "dark:bg-gray-800",
          className,
        )}
        {...props}
      >
        {children}
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
        title={copied ? "コピーしました" : "コードをコピー"}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

/**
 * インラインコード
 */
function InlineCode({ children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <code
      className={cn(
        "rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono",
        "dark:bg-gray-800",
      )}
      {...props}
    >
      {children}
    </code>
  );
}

/**
 * マークダウンコンポーネントのカスタマイズ
 */
const COMPONENTS: Components = {
  // 見出し
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-bold mt-5 mb-3 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-bold mt-4 mb-2 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-bold mt-3 mb-2 first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="text-sm font-bold mt-3 mb-2 first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="text-sm font-bold mt-3 mb-2 first:mt-0">{children}</h6>
  ),

  // 段落
  p: ({ children }) => <p className="my-2 leading-7">{children}</p>,

  // リスト
  ul: ({ children }) => (
    <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,

  // コードブロック
  pre: ({ children, ...props }) => <CodeBlock {...props}>{children}</CodeBlock>,

  // インラインコード
  code: ({ className, children, ...props }) => {
    // コードブロック内のcodeはそのまま表示
    const isInline = !className?.includes("language-");
    if (isInline) {
      return <InlineCode {...props}>{children}</InlineCode>;
    }
    return (
      <code className={cn("text-sm", className)} {...props}>
        {children}
      </code>
    );
  },

  // テーブル
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300 dark:border-gray-600">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-gray-100 dark:bg-gray-800">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-gray-300 dark:border-gray-600">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
      {children}
    </td>
  ),

  // 引用
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-gray-300 pl-4 my-4 italic text-gray-600 dark:text-gray-400 dark:border-gray-600">
      {children}
    </blockquote>
  ),

  // 水平線
  hr: () => (
    <hr className="my-6 border-t border-gray-300 dark:border-gray-600" />
  ),

  // リンク
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-blue-600 hover:underline dark:text-blue-400"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),

  // 強調
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,

  // 画像
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt || ""}
      className="max-w-full h-auto rounded my-4"
      loading="lazy"
    />
  ),
};

interface MarkdownRendererProps {
  /** マークダウンテキスト */
  children: string;
  /** 追加のクラス名 */
  className?: string;
}

/**
 * マークダウンレンダリングコンポーネント
 * GitHub Flavored Markdownに対応
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  children,
  className,
}: MarkdownRendererProps) {
  if (!children) {
    return null;
  }

  return (
    <div
      className={cn("prose prose-sm max-w-none dark:prose-invert", className)}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
});
