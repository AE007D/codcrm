"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPathname = useRef(pathname);

  // When pathname changes → navigation completed → finish bar
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      // Finish the bar
      setProgress(100);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }
  }, [pathname]);

  // Listen for link clicks to START the bar
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      // Only internal, non-anchor links
      if (!href || href.startsWith("http") || href.startsWith("mailto") || href.startsWith("tel") || href.startsWith("#")) return;
      if (href === pathname) return; // same page

      // Start the progress bar
      setProgress(10);
      setVisible(true);
      if (intervalRef.current) clearInterval(intervalRef.current);
      let p = 10;
      intervalRef.current = setInterval(() => {
        // Gradually slow down as we approach 85%
        const increment = p < 40 ? 8 : p < 65 ? 4 : p < 80 ? 2 : 0.5;
        p = Math.min(p + increment, 85);
        setProgress(p);
      }, 150);
    }

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pathname]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none"
      style={{ background: "transparent" }}
    >
      <div
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          transition: `width ${progress === 100 ? "0.15s ease-out" : "0.15s linear"}, opacity 0.3s ease`,
        }}
        className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] rounded-r-full"
      />
    </div>
  );
}
