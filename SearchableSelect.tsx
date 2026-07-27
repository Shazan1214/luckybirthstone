import { useState, useRef, useEffect, useId } from "react";

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  aliasMap?: Record<string, string[]>;
  allowCustom?: boolean;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Search…",
  className = "",
  aliasMap = {},
  allowCustom = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [highlighted, setHighlighted] = useState(0);
  const id = useId();

  const filtered = query.trim()
    ? options.filter((o) => {
        const q = query.toLowerCase();
        if (o.toLowerCase().includes(q)) return true;
        const aliases = aliasMap[o] ?? [];
        return aliases.some((a) => a.toLowerCase().includes(q));
      })
    : options;

  function getMatchedAlias(opt: string): string | null {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    if (opt.toLowerCase().includes(q)) return null;
    const aliases = aliasMap[opt] ?? [];
    return aliases.find((a) => a.toLowerCase().includes(q)) ?? null;
  }

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (allowCustom && query.trim()) {
          onChange(query.trim());
        }
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [allowCustom, query]);

  function openDropdown() {
    setOpen(true);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function select(opt: string) {
    onChange(opt);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openDropdown();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, (filtered.length + (allowCustom && query.trim() && !filtered.includes(query.trim()) ? 1 : 0)) - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const customOption = allowCustom && query.trim() && !filtered.includes(query.trim());
      if (customOption && highlighted === filtered.length) {
        select(query.trim());
      } else if (filtered[highlighted]) {
        select(filtered[highlighted]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.children[highlighted] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlighted, open]);

  const showCustomOption = allowCustom && query.trim() && !filtered.includes(query.trim());

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={openDropdown}
        className="form-select w-full text-left flex items-center justify-between gap-2 cursor-pointer"
      >
        <span className="truncate">{value || <span className="text-muted-foreground">{placeholder}</span>}</span>
        <svg
          className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={allowCustom ? "Search or type custom name…" : placeholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-input outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition"
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === "Escape") {
                    handleKeyDown(e);
                  }
                }}
              />
            </div>
            {allowCustom && (
              <p className="text-[10px] text-muted-foreground mt-1 px-1">Can't find your stone? Type the name and press Enter to use it.</p>
            )}
          </div>

          <ul
            ref={listRef}
            role="listbox"
            aria-labelledby={id}
            className="max-h-56 overflow-y-auto py-1"
          >
            {filtered.length === 0 && !showCustomOption ? (
              <li className="px-3 py-2 text-sm text-muted-foreground text-center">No results</li>
            ) : (
              <>
                {filtered.map((opt, i) => {
                  const matchedAlias = getMatchedAlias(opt);
                  return (
                    <li
                      key={opt}
                      role="option"
                      aria-selected={opt === value}
                      onMouseDown={(e) => { e.preventDefault(); select(opt); }}
                      onMouseEnter={() => setHighlighted(i)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${
                        i === highlighted ? "bg-primary/8 text-primary" : "hover:bg-secondary"
                      } ${opt === value ? "font-medium" : ""}`}
                    >
                      {opt === value ? (
                        <svg className="w-3.5 h-3.5 shrink-0 text-primary" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">{opt}</span>
                        {matchedAlias && (
                          <span className="block text-[10px] text-muted-foreground truncate">also known as: {matchedAlias}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
                {showCustomOption && (
                  <li
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => { e.preventDefault(); select(query.trim()); }}
                    onMouseEnter={() => setHighlighted(filtered.length)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors border-t border-border mt-1 ${
                      highlighted === filtered.length ? "bg-primary/8 text-primary" : "hover:bg-secondary"
                    }`}
                  >
                    <span className="w-3.5 shrink-0 text-xs">+</span>
                    <span>
                      <span className="block">Use "{query.trim()}"</span>
                      <span className="block text-[10px] text-muted-foreground">Custom stone name</span>
                    </span>
                  </li>
                )}
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
