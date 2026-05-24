import { type CSSProperties, useEffect, useMemo, useState } from "react";
import type { DeckDocument, SlideBlock } from "@agentdeck/schema";
import { resolveTheme } from "@agentdeck/themes";

export function AgentDeckApp({ deck }: { deck: DeckDocument }) {
  const [index, setIndex] = useState(0);
  const theme = useMemo(() => resolveTheme(deck.meta.theme), [deck.meta.theme]);
  const slide = deck.slides[index];

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
        setIndex((value) => Math.min(deck.slides.length - 1, value + 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        setIndex((value) => Math.max(0, value - 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deck.slides.length]);

  return (
    <div
      className="agentdeck-react"
      style={
        {
          "--ad-paper": theme.paper,
          "--ad-ink": theme.ink,
          "--ad-accent": theme.accent,
          "--ad-surface": theme.surface,
        } as CSSProperties
      }
    >
      <header className="react-toolbar">
        <button onClick={() => setIndex((value) => Math.max(0, value - 1))}>Previous</button>
        <span>{index + 1} / {deck.slides.length}</span>
        <button onClick={() => setIndex((value) => Math.min(deck.slides.length - 1, value + 1))}>Next</button>
      </header>
      <main className={`react-slide layout-${slide.layout}`}>
        <p className="react-kicker">{slide.layout}</p>
        <h1>{slide.title}</h1>
        <div className="react-blocks">{slide.blocks.map((block, blockIndex) => <BlockView block={block} key={blockIndex} />)}</div>
      </main>
    </div>
  );
}

function BlockView({ block }: { block: SlideBlock }) {
  if (block.type === "paragraph") return <p>{block.text}</p>;
  if (block.type === "list") return <ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
  if (block.type === "quote") return <blockquote>{block.text}</blockquote>;
  if (block.type === "image") return <img src={block.src} alt={block.alt} />;
  if (block.type === "table") {
    return (
      <table>
        <thead><tr>{block.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, index) => <tr key={index}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
      </table>
    );
  }
  if (block.type === "code") return <pre><code>{block.code}</code></pre>;
  if (block.type === "kpi") return <strong>{block.value}</strong>;
  if (block.type === "diagram") return <pre>{block.code}</pre>;
  if (block.type === "formula") return <p>{block.text}</p>;
  if (block.type === "html") return <div dangerouslySetInnerHTML={{ __html: block.html }} />;
  return null;
}
