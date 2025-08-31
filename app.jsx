import { tokens } from './styles/tokens';

function Button({ children, onClick, variant = "primary", icon: Icon, className = "", type = "button", size = "md", ariaLabel }) {
  // Usa tokens per colori, radius, font
  const base =
    `inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition active:translate-y-[1px] focus:outline-none focus:ring-2 focus:ring-[${tokens.palette.brand}] font-sans`
    + ` px-4 py-2`
    + ` border-0`
    + ``
  ;
  const sizes = {
    md: `px-4 py-2 text-[${tokens.typography.fontSize}] rounded-[${tokens.radius.md}]`,
    sm: `px-3 py-1.5 text-xs rounded-[${tokens.radius.sm}]`,
  };
  const variants = {
    primary: `bg-[${tokens.palette.brand}] text-white hover:bg-[${tokens.palette.brandDark}] shadow-sm`,
    ghost: `border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800`,
    subtle: `bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700`,
  };
  return (
    <button
      type={type}
      onClick={onClick}
      className={[base, sizes[size] || sizes.md, variants[variant], className].join(" ")}
      aria-label={ariaLabel || (typeof children === "string" ? children : undefined)}
      tabIndex={0}
      style={{
        borderRadius: tokens.radius.md,
        fontFamily: tokens.typography.fontFamily,
        fontWeight: tokens.typography.fontWeight
      }}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}

function TopBar({ theme, setTheme, route, setRoute, company }) {
  return (
    <nav
      className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur dark:bg-zinc-950/75"
      role="navigation"
      aria-label="Navigazione principale"
      style={{
        background: theme === "dark" ? tokens.palette.surfaceDark : tokens.palette.surface,
        borderColor: theme === "dark" ? tokens.palette.surfaceDark : "#e5e7eb",
        fontFamily: tokens.typography.fontFamily
      }}
    >
      {/* ...existing code... */}
    </nav>
  );
}

function Footer({ company }) {
  const year = new Date().getFullYear();
  return (
    <footer
      className="fixed bottom-0 left-0 right-0 border-t px-4 py-2 text-center text-xs backdrop-blur"
      role="contentinfo"
      style={{
        background: tokens.palette.surface,
        color: tokens.palette.text,
        borderColor: "#e5e7eb",
        fontFamily: tokens.typography.fontFamily
      }}
    >
      {t('footer.copyright').replace('{year}', year).replace('{company}', company?.name || "La Mia Azienda")}
    </footer>
  );
}

// Stampa: layout pulito, margini 10mm, numerazione pagine, nascondi elementi non necessari
<style>{`
  @media print {
    html, body {
      background: white !important;
      color: #18181b !important;
      font-family: ${tokens.typography.fontFamily} !important;
      font-size: 14px !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .print\\:block { display: block !important; }
    .print\\:break-before-page { break-before: page; }
    .print\\:shadow-none { box-shadow: none !important; }
    .rounded-2xl, .rounded-xl { border-radius: 0 !important; }
    .border { border: none !important; }
    .bg-white, .dark\\:bg-zinc-900 { background: white !important; }
    .sticky, .fixed, .footer, .topbar, .nav, .sidebar { display: none !important; }
    main, .client-copy, .vendor-copy {
      margin: 10mm !important;
      padding: 0 !important;
      background: white !important;
      color: #18181b !important;
      box-shadow: none !important;
    }
    @page {
      margin: 10mm;
      size: A4;
    }
    body:after {
      content: counter(page);
      position: fixed;
      bottom: 10mm;
      right: 10mm;
      font-size: 12px;
      color: #888;
    }
  }
`}</style>