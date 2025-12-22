"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * パンくずリストコンポーネント
 * 階層構造を示すナビゲーション
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      className="flex items-center text-sm text-gray-500 mb-6"
      aria-label="パンくず"
    >
      <Link
        href="/projects"
        className="hover:text-gray-700 transition-colors duration-150 flex items-center"
      >
        <Home className="size-4 mr-1" />
        プロジェクト
      </Link>
      {items.map((item, index) => (
        <span key={index} className="flex items-center">
          <ChevronRight className="mx-2 size-4" />
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-gray-700 transition-colors duration-150"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
