import { useState, useEffect } from 'react';

export const ScrollDotsNav = ({ sections = [] }) => {
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id || 'hero');
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(100, Math.round((scrollY / docHeight) * 100)) : 0;
      setScrollProgress(progress);

      // Determine active section based on proximity to viewport center
      const triggerY = window.innerHeight * 0.35;
      for (let i = sections.length - 1; i >= 0; i--) {
        const sec = sections[i];
        const el = document.getElementById(sec.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= triggerY) {
            setActiveSectionId(sec.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -70; // Header offset
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <aside
      aria-label="Section dot navigation indicator"
      className="fixed right-3 sm:right-5 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center gap-3 bg-slate-950/70 backdrop-blur-md p-2.5 rounded-full border border-slate-800/80 shadow-2xl"
    >
      {/* Mini Progress pill */}
      <span className="text-[9px] font-mono font-bold text-sky-400 select-none pb-1">
        {scrollProgress}%
      </span>

      {sections.map((sec) => {
        const isActive = activeSectionId === sec.id;
        return (
          <button
            key={sec.id}
            type="button"
            onClick={() => scrollToSection(sec.id)}
            className="group relative flex items-center justify-center p-1 focus:outline-none cursor-pointer"
            aria-label={`Scroll to ${sec.label}`}
          >
            {/* Tooltip on left hover */}
            <span className="absolute right-8 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap z-50">
              {sec.icon && <span className="mr-1.5">{sec.icon}</span>}
              {sec.label}
            </span>

            {/* Glowing Dot */}
            <div
              className={`rounded-full transition-all duration-300 ${isActive
                ? 'w-3.5 h-3.5 bg-sky-400 ring-4 ring-sky-500/30 scale-125 shadow-[0_0_12px_rgba(56,189,248,0.8)]'
                : 'w-2 h-2 bg-slate-600 hover:bg-slate-400 group-hover:scale-125'
                }`}
            />
          </button>
        );
      })}
    </aside>
  );
};
