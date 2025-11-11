import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export function HeroGrid() {
  const gridRef = useRef<HTMLDivElement>(null);
  const config = { cols: 30, rows: 10 };

  useEffect(() => {
    if (!gridRef.current) return;

    // Handle touch devices
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
      const grid = gridRef.current;

      const handlePointerMove = (event: PointerEvent) => {
        const hoveredElement = document.querySelector("[data-hover]");
        hoveredElement?.removeAttribute("data-hover");

        const element = document.elementFromPoint(event.clientX, event.clientY);
        if (element?.classList.contains("grid-cell")) {
          (element as HTMLElement).dataset.hover = "true";
        }
      };

      const handlePointerLeave = () => {
        document.querySelector("[data-hover]")?.removeAttribute("data-hover");
      };

      grid.addEventListener("pointermove", handlePointerMove);
      grid.addEventListener("pointerleave", handlePointerLeave);

      return () => {
        grid.removeEventListener("pointermove", handlePointerMove);
        grid.removeEventListener("pointerleave", handlePointerLeave);
      };
    }
  }, []);

  const cells = Array.from({ length: config.cols * config.rows }, (_, index) => ({
    id: index,
    grade: Math.floor(Math.random() * 12 - 6),
    opacity: Math.min(Math.random(), 0.2),
    hue: Math.floor(Math.random() * 30),
  }));

  return (
    <section className="flex flex-col items-center justify-center px-6 py-12">
      <motion.div
        ref={gridRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="interactive-grid touch-none"
        style={{
          display: "grid",
          gridTemplate: `repeat(${config.rows}, 1fr) / repeat(${config.cols}, 1fr)`,
          fontSize: "clamp(0.5rem, 1.5vw, 0.75rem)",
          fontWeight: 600,
          lineHeight: 1,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          cursor: "none",
          maxWidth: "min(90vw, 1000px)",
          aspectRatio: `${config.cols} / ${config.rows}`,
        }}
      >
        {cells.map((cell) => (
          <div
            key={cell.id}
            className="grid-cell touch-none"
            style={
              {
                "--grade": cell.grade,
                "--opacity": cell.opacity,
                "--hue": cell.hue,
              } as React.CSSProperties & {
                "--grade": number;
                "--opacity": number;
                "--hue": number;
              }
            }
          >
            +
          </div>
        ))}
      </motion.div>
    </section>
  );
}
