"use client";

// NIP v3.0 — Lightweight Markdown renderer
// Replaces react-markdown (which crashes at runtime in Next.js prod builds
// because it's ESM-only). Handles the common Markdown used in briefing output:
// headings, bold, italic, links, bullet lists, numbered lists, blockquotes,
// code spans, and paragraphs.

import * as React from "react";

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Combined regex for **bold**, *italic*, `code`, [link](url)
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`} className="font-semibold">{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-i${i}`} className="italic">{match[3]}</em>);
    } else if (match[4] !== undefined) {
      nodes.push(<code key={`${keyPrefix}-c${i}`} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{match[4]}</code>);
    } else if (match[5] !== undefined && match[6] !== undefined) {
      nodes.push(
        <a key={`${keyPrefix}-a${i}`} href={match[6]} target="_blank" rel="noreferrer" className="text-primary underline hover:no-underline">
          {match[5]}
        </a>
      );
    }
    lastIndex = regex.lastIndex;
    i++;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

export function SimpleMarkdown({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let blockquoteLines: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = listItems.map((item, idx) => (
      <li key={`li${key++}`} className="my-0.5">
        {renderInline(item, `li${key}`)}
      </li>
    ));
    if (listType === "ol") {
      blocks.push(<ol key={`ol${key++}`} className="my-2 list-decimal pl-5">{items}</ol>);
    } else {
      blocks.push(<ul key={`ul${key++}`} className="my-2 list-disc pl-5">{items}</ul>);
    }
    listItems = [];
    listType = null;
  };

  const flushBlockquote = () => {
    if (blockquoteLines.length === 0) return;
    const text = blockquoteLines.join(" ");
    blocks.push(
      <blockquote key={`bq${key++}`} className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground my-2">
        {renderInline(text, `bq${key}`)}
      </blockquote>
    );
    blockquoteLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Headings
    if (/^###\s+/.test(trimmed)) {
      flushList(); flushBlockquote();
      blocks.push(<h3 key={`h3${key++}`} className="text-sm font-semibold mt-2 mb-1">{renderInline(trimmed.replace(/^###\s+/, ""), `h3${key}`)}</h3>);
      continue;
    }
    if (/^##\s+/.test(trimmed)) {
      flushList(); flushBlockquote();
      blocks.push(<h2 key={`h2${key++}`} className="text-base font-semibold mt-3 mb-1.5">{renderInline(trimmed.replace(/^##\s+/, ""), `h2${key}`)}</h2>);
      continue;
    }
    if (/^#\s+/.test(trimmed)) {
      flushList(); flushBlockquote();
      blocks.push(<h1 key={`h1${key++}`} className="text-lg font-semibold mt-4 mb-2">{renderInline(trimmed.replace(/^#\s+/, ""), `h1${key}`)}</h1>);
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(trimmed)) {
      flushList();
      blockquoteLines.push(trimmed.replace(/^>\s?/, ""));
      continue;
    } else {
      flushBlockquote();
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(trimmed.replace(/^\d+\.\s+/, ""));
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(trimmed)) {
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }

    // Not a list item — flush any pending list
    flushList();

    // Empty line — skip (acts as paragraph separator)
    if (trimmed === "") {
      continue;
    }

    // Regular paragraph
    blocks.push(<p key={`p${key++}`} className="my-2">{renderInline(trimmed, `p${key}`)}</p>);
  }

  flushList();
  flushBlockquote();

  return <div className="text-sm leading-relaxed">{blocks}</div>;
}
