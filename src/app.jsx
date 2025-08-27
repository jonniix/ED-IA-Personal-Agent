import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sun, Moon, Wrench, PlugZap, Settings, Home, FileText, Printer, Archive } from "lucide-react";
import { saveOfferToDB, getOfferFromDB, listOffersFromDB, deleteOfferFromDB, savePdfToDB, getPdfFromDB } from "../lib/db";

// --- Utility helpers ---
const currency = (n, currency = "CHF") =>
  new Intl.NumberFormat("it-CH", { style: "currency", currency }).format(Number(n || 0));

const number = (n, digits = 0) =>
  new Intl.NumberFormat("it-CH", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(
    Number(n || 0)
  );

const cls = (...arr) => arr.filter(Boolean).join(" ");

// Funzione per generare reference offerta progressivo
function nextOfferRef() {
  const key = 'pv_last_offer_ref';
  const last = Number(localStorage.getItem(key) || '0');
  let now = Date.now();
  if (now <= last) now = last + 1;
  localStorage.setItem(key, String(now));
  return `FV-${now}`;
}

// Default settings (admin-editable)
const DEFAULT_SETTINGS = {
  company: {
    name: "Edil Repairs Sagl",
    logoText: "FV+",
    address: "Via Sole 1, 6900 Lugano",
    phone: "+41 00 000 00 00",
    email: "info@edil-repairs.ch",
  },
  pricing: {
    energyPriceCHFPerKWh: 0.28,
    maintenancePricePerPanelCHF: 35,
    vatPercent: 8.1,
    systemPricePerKWCHF: 1800,
    curvePricingEnabled: true,
    curve: {
      minKW: 8,
      priceAtMin: 2000,
      maxKW: 200,
      priceAtMax: 1000,
    },
    incentives: {
      federalCHFPerKW: 360,
      cantonalCHFPerKW: 180,
      municipalCHFPerKW: 10,
    },
    selfConsumptionPctWithHeatPump: 75,
    selfConsumptionPctWithoutHeatPump: 65,
    exportPriceCHFPerKWh: 0.05,
  },
  environment: {
    co2GridKgPerKWh: 0.12,
    co2PerTreeKgPerYear: 21
  },
  pvSizesKW: [8, 10, 12, 16, 25, 33],
  // Mini mappa CAP->Comune (estendibile in Admin). L'utente può sempre sovrascrivere manualmente.
  capToCity: {
    "6500": "Bellinzona",
    "6600": "Locarno",
    "6616": "Losone",
    "6900": "Lugano",
    "1200": "Genève",
    "1010": "Lausanne",
    "8000": "Zürich",
    "3000": "Bern",
    "4051": "Basel",
  },
  locked: {
    company: false,
    pricing: false,
    curve: false,
    incentives: false,
    energy: false
  }
};

const loadSettings = () => {
  try {
    const raw = localStorage.getItem("pv_event_toolkit_settings");
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // shallow merge defaults for safety
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      company: { ...DEFAULT_SETTINGS.company, ...(parsed.company || {}) },
      pricing: { ...DEFAULT_SETTINGS.pricing, ...(parsed.pricing || {}) },
      environment: { ...DEFAULT_SETTINGS.environment, ...(parsed.environment || {}) },
      capToCity: { ...DEFAULT_SETTINGS.capToCity, ...(parsed.capToCity || {}) },
      pvSizesKW: parsed.pvSizesKW || DEFAULT_SETTINGS.pvSizesKW,
      locked: { ...DEFAULT_SETTINGS.locked, ...(parsed.locked || {}) }
    };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
};

const saveSettings = (s) => localStorage.setItem("pv_event_toolkit_settings", JSON.stringify(s));

// Persist last offer to allow quick re-open / printing
const saveOffer = (o) => localStorage.setItem("pv_event_toolkit_last_offer", JSON.stringify(o));
const loadOffer = () => {
  const raw = localStorage.getItem("pv_event_toolkit_last_offer");
  return raw ? JSON.parse(raw) : null;
};

// --- Helper per prezzo da curva ---
function pricePerKWFromCurve(kw, curve){
  if(!curve) return 0;
  const minKW=parseFloat(String(curve.minKW).replace(',','.'))||8;
  const maxKW=parseFloat(String(curve.maxKW).replace(',','.'))||200;
  const pMin=parseFloat(String(curve.priceAtMin).replace(',','.'))||2000;
  const pMax=parseFloat(String(curve.priceAtMax).replace(',','.'))||1000;
  const k=Math.max(minKW, Math.min(maxKW, parseFloat(String(kw).replace(',','.'))||0));
  const t=(k-minKW)/(maxKW-minKW);
  return pMin+(pMax-pMin)*t;
}

// --- Core App ---
export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("pv_theme") || "dark");
  const [route, setRoute] = useState("home"); // home | new | maint | admin | offer | archive
  const [settings, setSettings] = useState(loadSettings);
  const [installForm, setInstallForm] = useState({
    firstName: "",
    lastName: "",
    street: "",
    cap: "",
    city: "",
    country: "Svizzera",
    annualCostCHF: "",
    annualKWh: "",
    heatPump: false,
  });
  const [maintForm, setMaintForm] = useState({
    firstName: "",
    lastName: "",
    street: "",
    cap: "",
    city: "",
    country: "Svizzera",
    panels: "",
    extraNotes: "",
  });

  const [offer, setOffer] = useState(loadOffer());
  const [unlockedGroups, setUnlockedGroups] = useState(() => {
    const stored = sessionStorage.getItem('pv_unlocked_groups');
    return stored ? JSON.parse(stored) : {};
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("pv_theme", theme);
  }, [theme]);

  // Auto-lookup City from CAP
  useEffect(() => {
    const cap = installForm.cap?.trim();
    if (cap && settings.capToCity[cap]) {
      setInstallForm((f) => ({ ...f, city: settings.capToCity[cap] }));
    }
  }, [installForm.cap, settings.capToCity]);

  useEffect(() => {
    const cap = maintForm.cap?.trim();
    if (cap && settings.capToCity[cap]) {
      setMaintForm((f) => ({ ...f, city: settings.capToCity[cap] }));
    }
  }, [maintForm.cap, settings.capToCity]);

  const suggestSizes = (kWh) => {
    const targetKW = Math.max(0, Number(kWh || 0) / 1000); // ~1kWp ≈ 1MWh/anno
    const sizes = settings.pvSizesKW.slice().sort((a, b) => a - b);
    // sort by closeness to target
    const ranked = sizes
      .map((s) => ({ size: s, d: Math.abs(s - targetKW) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .map((x) => x.size);
    return ranked;
  };

  // Generate installation offer
  const buildInstallOffer = (selectedKW) => {
    const p = settings.pricing;
    const annualCost = parseFloat(String(installForm.annualCostCHF).replace(',', '.')) || 0;
    const kWh = installForm.annualKWh ? parseFloat(String(installForm.annualKWh).replace(',', '.')) || 0 : annualCost / p.energyPriceCHFPerKWh;
    const sizes = suggestSizes(kWh);

    const offerRef = nextOfferRef();
    
    const payload = {
      type: "install",
      offerRef,
      createdAt: new Date().toISOString(),
      customer: installForm,
      computed: {
        annualKWh: kWh,
        suggestedSizesKW: sizes,
        heatPump: installForm.heatPump,
        energyPriceCHFPerKWh: p.energyPriceCHFPerKWh,
        selectedKW: selectedKW ?? (sizes[1] || sizes[0] || 0),
      },
      settingsSnapshot: settings,
    };
    setOffer(payload);
    saveOffer(payload);
    saveOfferToDB(payload);
    setRoute("offer");
  };

  // Generate maintenance offer (calcolo prezzo nascosto)
  const buildMaintOffer = () => {
    const p = settings.pricing;
    const panels = Math.max(0, parseFloat(String(maintForm.panels).replace(',', '.')) || 0);
    const net = panels * p.maintenancePricePerPanelCHF; // non mostrato nei campi, solo totale finale
    const vat = (net * p.vatPercent) / 100;
    const gross = net + vat;

    const offerRef = nextOfferRef();
    
    const payload = {
      type: "maintenance",
      offerRef,
      createdAt: new Date().toISOString(),
      customer: maintForm,
      computed: {
        panels,
        net,
        vat,
        gross,
        pricePerPanel: p.maintenancePricePerPanelCHF,
        vatPercent: p.vatPercent,
      },
      settingsSnapshot: settings,
    };
    setOffer(payload);
    saveOffer(payload);
    saveOfferToDB(payload);
    setRoute("offer");
  };

  const resetAll = () => {
    setInstallForm({
      firstName: "",
      lastName: "",
      street: "",
      cap: "",
      city: "",
      country: "Svizzera",
      annualCostCHF: "",
      annualKWh: "",
      heatPump: false,
    });
    setMaintForm({ firstName: "", lastName: "", street: "", cap: "", city: "", country: "Svizzera", panels: "", extraNotes: "" });
    setOffer(null);
    setRoute("home");
  };

  const unlockGroup = (group) => {
    const newUnlocked = {...unlockedGroups, [group]: true};
    setUnlockedGroups(newUnlocked);
    sessionStorage.setItem('pv_unlocked_groups', JSON.stringify(newUnlocked));
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <TopBar theme={theme} setTheme={setTheme} route={route} setRoute={setRoute} company={settings.company} />

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">
        {route === "home" && <HomeScreen setRoute={setRoute} company={settings.company} />}
        {route === "new" && (
          <InstallForm
            form={installForm}
            setForm={setInstallForm}
            settings={settings}
            onCreate={buildInstallOffer}
          />
        )}
        {route === "maint" && (
          <MaintenanceForm form={maintForm} setForm={setMaintForm} settings={settings} onCreate={buildMaintOffer} />
        )}
        {route === "admin" && (
          <AdminPanel 
            settings={settings} 
            setSettings={setSettings} 
            unlockedGroups={unlockedGroups}
            unlockGroup={unlockGroup}
          />
        )}
        {route === "offer" && offer && (
          <OfferView
            offer={offer}
            onNew={resetAll}
            onEdit={() => setRoute(offer?.type === 'install' ? 'new' : 'maint')}
          />
        )}
        {route === "archive" && (
          <ArchiveView 
            onSelectOffer={(offer) => {
              setOffer(offer);
              saveOffer(offer);
              setRoute("offer");
            }}
          />
        )}
      </main>

      <Footer company={settings.company} />
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={cls(
      "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition dark:border-zinc-800 dark:bg-zinc-900",
      className
    )}>
      {children}
    </div>
  );
}

function Labeled({ label, children }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={cls(
        "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-zinc-400",
        "focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-950",
        props.className
      )}
    />
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Button({ children, onClick, variant = "primary", icon: Icon, className = "", type = "button" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition active:translate-y-[1px]";
  const variants = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-sm",
    ghost: "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
    subtle: "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700",
  };
  return (
    <button type={type} onClick={onClick} className={cls(base, variants[variant], className)}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

function TopBar({ theme, setTheme, route, setRoute, company }) {
  return (
    <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/75">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={import.meta.env.BASE_URL + "img/logoedil.png"} alt="Edil Repairs" className="h-8 w-auto object-contain" />
          <div>
            <div className="text-sm font-semibold leading-4">{company.name}</div>
            <div className="text-xs text-zinc-500">Edil Repairs Artificial Intelligence</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" icon={Home} onClick={() => setRoute("home")}>Home</Button>
          <Button variant="ghost" icon={Archive} onClick={() => setRoute("archive")}>Archivio</Button>
          <Button variant="ghost" icon={Settings} onClick={() => setRoute("admin")}>Admin</Button>
          <Button
            variant="subtle"
            icon={theme === "dark" ? Sun : Moon}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function HomeScreen({ setRoute, company }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Benvenuto!</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Seleziona l'operazione per creare un'offerta in pochi secondi.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">Nuovo impianto FV</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Inserisci i dati del cliente e calcola rapidamente le taglie proposte.
              </p>
            </div>
            <div className="rounded-xl bg-blue-600/10 p-3 text-blue-600 dark:text-blue-400">
              <PlugZap />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button icon={PlugZap} onClick={() => setRoute("new")}>Avvia</Button>
            <Button variant="ghost" onClick={() => setRoute("offer")}>Apri ultima offerta</Button>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">Manutenzione & Pulizia</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Calcolo interno {currency(35)} + IVA a pannello (modificabile in Admin).
              </p>
            </div>
            <div className="rounded-xl bg-emerald-600/10 p-3 text-emerald-600 dark:text-emerald-400">
              <Wrench />
            </div>
          </div>
          <div className="mt-4">
            <Button icon={Wrench} onClick={() => setRoute("maint")}>Avvia</Button>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

function PersonFields({ form, setForm, settings }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Labeled label="Nome">
        <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
      </Labeled>
      <Labeled label="Cognome">
        <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
      </Labeled>
      <Labeled label="Via e n°">
        <Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
      </Labeled>
      <div className="grid grid-cols-5 gap-3 md:col-span-2">
        <Labeled label="CAP">
          <Input
            value={form.cap}
            onChange={(e) => setForm({ ...form, cap: e.target.value.replace(/[^0-9]/g, "") })}
            placeholder="es. 6900"
          />
        </Labeled>
        <div className="col-span-3">
          <Labeled label="Città">
            <Input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder={settings.capToCity[form.cap] ? `Autocompletata: ${settings.capToCity[form.cap]}` : "Inserisci città"}
            />
          </Labeled>
        </div>
        <Labeled label="Paese">
          <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </Labeled>
      </div>
    </div>
  );
}

function InstallForm({ form, setForm, settings, onCreate }) {
  const p = settings.pricing;
  const derivedKWh = useMemo(() => {
    const cost = parseFloat(String(form.annualCostCHF).replace(',', '.')) || 0;
    return cost > 0 ? cost / p.energyPriceCHFPerKWh : 0;
  }, [form.annualCostCHF, p.energyPriceCHFPerKWh]);

  const kWh = parseFloat(String(form.annualKWh).replace(',', '.')) || 0 || derivedKWh;

  // Nuova funzione per opzioni S/M/L
  function buildOptionsAround(sizes, targetKW) {
    const arr = sizes.slice().sort((a,b)=>a-b);
    if (!arr.length) return { options: [], mid: 0 };

    let idx = 0, best = Infinity;
    for (let i=0;i<arr.length;i++){
      const d = Math.abs(arr[i]-targetKW);
      if (d < best) { best = d; idx = i; }
    }
    const M = arr[idx];

    const smaller = arr.filter(v => v < M);
    const larger  = arr.filter(v => v > M);

    let S = smaller.length ? smaller[smaller.length-1] : (arr[idx+1] ?? M);
    let L = larger.length  ? larger[0]                : (arr[idx-1] ?? M);

    let options = [S, M, L].filter((v,i,a)=>a.indexOf(v)===i);
    if (options.length < 3){
      for (const v of arr){
        if (!options.includes(v)) options.push(v);
        if (options.length === 3) break;
      }
    }
    options.sort((a,b)=>a-b);
    return { options, mid: M };
  }

  const targetKW = kWh > 0 ? kWh / 1000 : 0;
  const { options: sizeOptions, mid } = useMemo(
    () => buildOptionsAround(settings.pvSizesKW, targetKW),
    [settings.pvSizesKW, targetKW]
  );

  const [selectedKW, setSelectedKW] = useState(mid);
  useEffect(() => { setSelectedKW(mid); }, [mid]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Nuovo impianto FV</h2>
        <div className="text-xs text-zinc-500">Prezzo energia ass.: {number(p.energyPriceCHFPerKWh, 2)} CHF/kWh</div>
      </div>
      <Card>
        <div className="grid gap-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Dati cliente</h3>
            <PersonFields form={form} setForm={setForm} settings={settings} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Labeled label="Costo energetico annuo (CHF)">
              <Input
                inputMode="decimal"
                placeholder="es. 2400"
                value={form.annualCostCHF}
                onChange={(e) => setForm({ ...form, annualCostCHF: e.target.value.replace(
                  /[^0-9.,]/g,
                  ""
                ) })}
              />
            </Labeled>
            <Labeled label="Consumo annuo (kWh)">
              <Input
                inputMode="decimal"
                placeholder={derivedKWh ? number(derivedKWh, 0) : "es. 9000"}
                value={form.annualKWh}
                onChange={(e) => setForm({ ...form, annualKWh: e.target.value.replace(/[^0-9.,]/g, "") })}
              />
            </Labeled>
            <div className="flex items-end">
              <Checkbox
                checked={form.heatPump}
                onChange={(v) => setForm({ ...form, heatPump: v })}
                label="Presenza di pompa di calore"
              />
            </div>
          </div>

          {kWh > 0 && sizeOptions.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900/50 dark:bg-blue-900/20">
              Consumo stimato: <b>{number(kWh, 0)} kWh/anno</b>. Opzioni:&nbsp;
              {sizeOptions.map((v) => {
                const label = v < mid ? "S" : v > mid ? "L" : "M";
                const selected = selectedKW === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSelectedKW(v)}
                    className={cls(
                      "mx-1 rounded-full px-3 py-1 text-xs font-semibold transition",
                      selected
                        ? "border border-blue-600 bg-blue-600/20 text-blue-700 dark:text-blue-300"
                        : "border border-blue-200 bg-blue-100 text-blue-700 dark:bg-blue-900/10 dark:text-blue-300",
                      "hover:border-blue-700"
                    )}
                    style={{ minWidth: 48 }}
                  >
                    {label}: {v} kW
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button icon={FileText} onClick={() => onCreate(selectedKW)}>
              Genera offerta
            </Button>
            <Button variant="ghost" onClick={() => window.history.back?.()}>Annulla</Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function MaintenanceForm({ form, setForm, settings, onCreate }) {
  const p = settings.pricing;
  const panels = Math.max(0, parseFloat(String(form.panels).replace(',', '.')) || 0);
  const net = panels * p.maintenancePricePerPanelCHF;
  const vat = (net * p.vatPercent) / 100;
  const gross = net + vat;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Manutenzione & Pulizia</h2>
        <div className="text-xs text-zinc-500">{number(p.vatPercent, 1)}% IVA · {currency(p.maintenancePricePerPanelCHF)}/pannello</div>
      </div>
      <Card>
        <div className="grid gap-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Dati cliente</h3>
            <PersonFields form={form} setForm={setForm} settings={settings} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Labeled label="N° pannelli">
              <Input
                inputMode="numeric"
                value={form.panels}
                onChange={(e) => setForm({ ...form, panels: e.target.value.replace(/[^0-9]/g, "") })}
                placeholder="es. 24"
              />
            </Labeled>
            <div className="md:col-span-2">
              <Labeled label="Note">
                <Input value={form.extraNotes} onChange={(e) => setForm({ ...form, extraNotes: e.target.value })} />
              </Labeled>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900/50 dark:bg-emerald-900/20">
            Anteprima totale (nascosta al cliente durante compilazione): <b>{currency(gross)}</b>
            </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={FileText} onClick={onCreate}>Genera offerta</Button>
            <Button variant="ghost" onClick={() => window.history.back?.()}>Annulla</Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function PasswordModal({ isOpen, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === '979851') {
      onSuccess();
      onClose();
    } else {
      setError('Password errata');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">Inserisci la password</h3>
        <form onSubmit={handleSubmit}>
          <Input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            placeholder="Password"
            className="w-full mb-2"
          />
          {error && <div className="text-red-500 text-sm mb-2">{error}</div>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>Annulla</Button>
            <Button type="submit">Sblocca</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminPanel({ settings, setSettings, unlockedGroups, unlockGroup }) {
  // Gestione stringhe locali per i campi numerici
  const [local, setLocal] = useState(() => {
    const s = JSON.parse(JSON.stringify(settings));
    // Trasforma i numerici in stringa per input
    s.pricing.energyPriceCHFPerKWh = String(s.pricing.energyPriceCHFPerKWh ?? "");
    s.pricing.maintenancePricePerPanelCHF = String(s.pricing.maintenancePricePerPanelCHF ?? "");
    s.pricing.vatPercent = String(s.pricing.vatPercent ?? "");
    s.pricing.systemPricePerKWCHF = String(s.pricing.systemPricePerKWCHF ?? "");
    s.pricing.selfConsumptionPctWithHeatPump = String(s.pricing.selfConsumptionPctWithHeatPump ?? "");
    s.pricing.selfConsumptionPctWithoutHeatPump = String(s.pricing.selfConsumptionPctWithoutHeatPump ?? "");
    s.pricing.exportPriceCHFPerKWh = String(s.pricing.exportPriceCHFPerKWh ?? "");
    s.environment.co2GridKgPerKWh = String(s.environment.co2GridKgPerKWh ?? "");
    s.environment.co2PerTreeKgPerYear = String(s.environment.co2PerTreeKgPerYear ?? "");
    return s;
  });

  const [pvSizesText, setPvSizesText] = useState(() =>
    Array.isArray(settings.pvSizesKW) ? settings.pvSizesKW.join(", ") : String(settings.pvSizesKW || "")
  );

  // Nuove variabili per gestione curve
  const [curveEnabled, setCurveEnabled] = useState(() => !!settings.pricing.curvePricingEnabled);
  const [curveMinKW, setCurveMinKW] = useState(() => String(settings.pricing.curve?.minKW ?? 8));
  const [curvePriceAtMin, setCurvePriceAtMin] = useState(() => String(settings.pricing.curve?.priceAtMin ?? 2000));
  const [curveMaxKW, setCurveMaxKW] = useState(() => String(settings.pricing.curve?.maxKW ?? 200));
  const [curvePriceAtMax, setCurvePriceAtMax] = useState(() => String(settings.pricing.curve?.priceAtMax ?? 1000));

  // Incentivi: string-first state
  const [federalIncentive, setFederalIncentive] = useState(() =>
    String(settings.pricing.incentives?.federalCHFPerKW ?? 360)
  );
  const [cantonalIncentive, setCantonalIncentive] = useState(() =>
    String(settings.pricing.incentives?.cantonalCHFPerKW ?? 180)
  );
  const [municipalIncentive, setMunicipalIncentive] = useState(() =>
    String(settings.pricing.incentives?.municipalCHFPerKW ?? 10)
  );

  const [passwordModal, setPasswordModal] = useState({ open: false, group: null });

  // Normalizza i campi numerici su blur/salva (esteso)
  const normalizePricing = (pricing) => {
    const norm = { ...pricing };
    const parseField = (val, fallback) => {
      const v = parseFloat(String(val).replace(",", "."));
      return isNaN(v) ? fallback : v;
    };
    norm.energyPriceCHFPerKWh = parseField(norm.energyPriceCHFPerKWh, settings.pricing.energyPriceCHFPerKWh);
    norm.maintenancePricePerPanelCHF = parseField(norm.maintenancePricePerPanelCHF, settings.pricing.maintenancePricePerPanelCHF);
    norm.vatPercent = parseField(norm.vatPercent, settings.pricing.vatPercent);
    norm.systemPricePerKWCHF = parseField(norm.systemPricePerKWCHF, settings.pricing.systemPricePerKWCHF);
    // Incentivi
    norm.incentives = {
      federalCHFPerKW: parseField(federalIncentive, settings.pricing.incentives?.federalCHFPerKW ?? 360),
      cantonalCHFPerKW: parseField(cantonalIncentive, settings.pricing.incentives?.cantonalCHFPerKW ?? 180),
      municipalCHFPerKW: parseField(municipalInceptives, settings.pricing.incentives?.municipalCHFPerKW ?? 10),
    };
    // Autoconsumo & Immissione (clamp 0-100 sulle %)
    norm.selfConsumptionPctWithHeatPump = Math.max(0, Math.min(100, parseFloat(String(norm.selfConsumptionPctWithHeatPump).replace(',', '.')) || 0));
    norm.selfConsumptionPctWithoutHeatPump = Math.max(0, Math.min(100, parseFloat(String(norm.selfConsumptionPctWithoutHeatPump).replace(',', '.')) || 0));
    norm.exportPriceCHFPerKWh = parseField(norm.exportPriceCHFPerKWh, settings.pricing.exportPriceCHFPerKWh ?? 0.05);
    return norm;
  };

  // Normalizza curve su blur/salva
  const normalizeCurve = (curve) => {
    return {
      minKW: parseInt(curcurveMinKW) || 8,
      priceAtMin: parseFloat(String(curvePriceAtMin).replace(",", ".")) || 2000,
      maxKW: parseInt(curveMaxKW) || 200,
      priceAtMax: parseFloat(String(curvePriceAtMax).replace(",", ".")) || 1000,
    };
  };

  const update = (path, value) => {
    const next = JSON.parse(JSON.stringify(local));
    const [a, b, c] = path.split(".");
    if (c !== undefined) next[a][b][c] = value;
    else if (b !== undefined) next[a][b] = value;
    else next[a] = value;
    setLocal(next);
  };

  const handleUnlock = (group) => {
    if (unlockedGroups[group]) return;
    setPasswordModal({ open: true, group });
  };

  const handlePasswordSuccess = (group) => {
    unlockGroup(group);
  };

  const isGroupLocked = (group) => {
    return settings.locked[group] && !unlockedGroups[group];
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Pannello amministratore</h2>
        <div className="text-xs text-zinc-500">Le modifiche vengono salvate nel dispositivo (localStorage)</div>
      </div>
      <div className="grid gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Azienda</h3>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={settings.locked.company}
                onChange={(v) => update("locked.company", v)}
                label="Protetto"
              />
              {isGroupLocked('company') && (
                <Button variant="subtle" size="sm" onClick={() => handleUnlock('company')}>
                  Sblocca
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Labeled label="Nome società">
              <Input 
                value={local.company.name} 
                onChange={(e) => update("company.name", e.target.value)} 
                disabled={isGroupLocked('company')}
              />
            </Labeled>
            <Labeled label="Logo (testo breve)">
              <Input 
                value={local.company.logoText} 
                onChange={(e) => update("company.logoText", e.target.value)} 
                disabled={isGroupLocked('company')}
              />
            </Labeled>
            <Labeled label="Telefono">
              <Input 
                value={local.company.phone} 
                onChange={(e) => update("company.phone", e.target.value)} 
                disabled={isGroupLocked('company')}
              />
            </Labeled>
            <Labeled label="Email">
              <Input 
                value={local.company.email} 
                onChange={(e) => update("company.email", e.target.value)} 
                disabled={isGroupLocked('company')}
              />
            </Labeled>
            <div className="md:col-span-3">
              <Labeled label="Indirizzo">
                <Input 
                  value={local.company.address} 
                  onChange={(e) => update("company.address", e.target.value)} 
                  disabled={isGroupLocked('company')}
                />
              </Labeled>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Parametri di calcolo</h3>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={settings.locked.pricing}
                onChange={(v) => update("locked.pricing", v)}
                label="Protetto"
              />
              {isGroupLocked('pricing') && (
                <Button variant="subtle" size="sm" onClick={() => handleUnlock('pricing')}>
                  Sblocca
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <Labeled label="Prezzo energia (CHF/kWh)">
              <Input
                inputMode="decimal"
                value={local.pricing.energyPriceCHFPerKWh}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,]*$/.test(v)) setLocal(l => ({ ...l, pricing: { ...l.pricing, energyPriceCHFPerKWh: v } }));
                }}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(",", "."));
                  setLocal(l => ({
                    ...l,
                    pricing: {
                      ...l.pricing,
                      energyPriceCHFPerKWh: isNaN(v) ? l.pricing.energyPriceCHFPerKWh : String(v)
                    }
                  }));
                }}
                disabled={isGroupLocked('pricing')}
              />
            </Labeled>
            <Labeled label="Manutenzione CHF/pannello (excl. IVA)">
              <Input
                inputMode="decimal"
                value={local.pricing.maintenancePricePerPanelCHF}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,]*$/.test(v)) setLocal(l => ({ ...l, pricing: { ...l.pricing, maintenancePricePerPanelCHF: v } }));
                }}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(",", "."));
                  setLocal(l => ({
                    ...l,
                    pricing: {
                      ...l.pricing,
                      maintenancePricePerPanelCHF: isNaN(v) ? l.pricing.maintenancePricePerPanelCHF : String(v)
                    }
                  }));
                }}
                disabled={isGroupLocked('pricing')}
              />
            </Labeled>
            <Labeled label="IVA %">
              <Input
                inputMode="decimal"
                value={local.pricing.vatPercent}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,]*$/.test(v)) setLocal(l => ({ ...l, pricing: { ...l.pricing, vatPercent: v } }));
                }}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(",", "."));
                  setLocal(l => ({
                    ...l,
                    pricing: {
                      ...l.pricing,
                      vatPercent: isNaN(v) ? l.pricing.vatPercent : String(v)
                    }
                  }));
                }}
                disabled={isGroupLocked('pricing')}
              />
            </Labeled>
            <Labeled label="Prezzo unitario impianto (CHF/kW)">
              <Input
                inputMode="decimal"
                value={local.pricing.systemPricePerKWCHF}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,]*$/.test(v)) setLocal(l => ({ ...l, pricing: { ...l.pricing, systemPricePerKWCHF: v } }));
                }}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(",", "."));
                  setLocal(l => ({
                    ...l,
                    pricing: {
                      ...l.pricing,
                      systemPricePerKWCHF: isNaN(v) ? l.pricing.systemPricePerKWCHF : String(v)
                    }
                  }));
                }}
                disabled={isGroupLocked('pricing')}
              />
            </Labeled>
            <Labeled label="Taglie FV disponibili (kW, separate da virgola)">
              <Input
                value={pvSizesText}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,;\s]*$/.test(v)) setPvSizesText(v);
                }}
                onBlur={() => {
                  const arr = pvSizesText
                    .split(/[;,\s]+/)
                    .map(x => parseFloat(String(x).replace(",", ".")))
                    .filter(x => !isNaN(x) && x > 0);
                  setLocal(l => ({ ...l, pvSizesKW: arr }));
                  setPvSizesText(arr.join(", "));
                }}
                disabled={isGroupLocked('pricing')}
              />
            </Labeled>
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Range prezzo (CHF/kW)</h3>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={settings.locked.curve}
                onChange={(v) => update("locked.curve", v)}
                label="Protetto"
              />
              {isGroupLocked('curve') && (
                <Button variant="subtle" size="sm" onClick={() => handleUnlock('curve')}>
                  Sblocca
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <div className="flex items-center gap-2 md:col-span-5">
              <Checkbox
                checked={curveEnabled}
                onChange={setCurveEnabled}
                label="Abilita range prezzo"
                disabled={isGroupLocked('curve')}
              />
            </div>
            <Labeled label="Potenza minima (kW)">
              <Input
                inputMode="numeric"
                value={curveMinKW}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9]*$/.test(v)) setCurveMinKW(v);
                }}
                onBlur={e => {
                  const v = parseInt(e.target.value);
                  setCurcurveMinKW(isNaN(v) ? curveMinKW : String(v));
                }}
                disabled={isGroupLocked('curve')}
              />
            </Labeled>
            <Labeled label="Prezzo di partenza (CHF/kW @ min)">
              <Input
                inputMode="decimal"
                value={curvePriceAtMin}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,]*$/.test(v)) setCurvePriceAtMin(v);
                }}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(",", "."));
                  setCurvePriceAtMin(isNaN(v) ? curvePriceAtMin : String(v));
                }}
                disabled={isGroupLocked('curve')}
              />
            </Labeled>
            <Labeled label="Soglia alta (kW)">
              <Input
                inputMode="numeric"
                value={curveMaxKW}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9]*$/.test(v)) setCurveMaxKW(v);
                }}
                onBlur={e => {
                  const v = parseInt(e.target.value);
                  setCurveMaxKW(isNaN(v) ? curveMaxKW : String(v));
                }}
                disabled={isGroupLocked('curve')}
              />
            </Labeled>
            <Labeled label="Prezzo per impianti ≥ soglia (CHF/kW)">
              <Input
                inputMode="decimal"
                value={curvePriceAtMax}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,]*$/.test(v)) setCurvePriceAtMax(v);
                }}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(",", "."));
                  setCurvePriceAtMax(isNaN(v) ? curvePriceAtMax : String(v));
                }}
                disabled={isGroupLocked('curve')}
              />
            </Labeled>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            8 kW → {currency(pricePerKWFromCurve(8, {minKW:curveMinKW,priceAtMin:curvePriceAtMin,maxKW:curveMaxKW,priceAtMax:curvePriceAtMax}))}
            &nbsp;·&nbsp;50 kW → {currency(pricePerKWFromCurcurve(50, {minKW:curveMinKW,priceAtMin:curvePriceAtMin,maxKW:curveMaxKW,priceAtMax:curvePriceAtMax}))}
            &nbsp;·&nbsp;200 kW → {currency(pricePerKWFromCurve(200, {minKW:curveMinKW,priceAtMin:curvePriceAtMin,maxKW:curveMaxKW,priceAtMax:curvePriceAtMax}))}
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Incentivi (CHF/kW)</h3>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={settings.locked.incentives}
                onChange={(v) => update("locked.incentives", v)}
                label="Protetto"
              />
              {isGroupLocked('incentives') && (
                <Button variant="subtle" size="sm" onClick={() => handleUnlock('incentives')}>
                  Sblocca
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Labeled label="Incentivo federale (CHF/kW)">
              <Input
                inputMode="decimal"
                value={federalIncentive}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,]*$/.test(v)) setFederalIncentive(v);
                }}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(",", "."));
                  setFederalIncentive(isNaN(v) ? federalIncentive : String(v));
                }}
                disabled={isGroupLocked('incentives')}
              />
            </Labeled>
            <Labeled label="Incentivo cantonale (CHF/kW)">
              <Input
                inputMode="decimal"
                value={cantonalIncentive}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,]*$/.test(v)) setCantonalIncentive(v);
                }}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(",", "."));
                  setCantonalIncentive(isNaN(v) ? cantonalIncentive : String(v));
                }}
                disabled={isGroupLocked('incentives')}
              />
            </Labeled>
            <Labeled label="Incentivo comunale (CHF/kW)">
              <Input
                inputMode="decimal"
                value={municipalIncentive}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,]*$/.test(v)) setMunicipalIncentive(v);
                }}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(",", "."));
                  setMunicipalIncentive(isNaN(v) ? municipalIncentive : String(v));
                }}
                disabled={isGroupLocked('incentives')}
              />
            </Labeled>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Nota: i valori sono in CHF/kW. L'incentivo comunale è indicativo e altamente variabile; conferma necessaria. Federale e cantonale sono generalmente garantiti.
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Autoconsumo & Immissione</h3>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={settings.locked.energy}
                onChange={(v) => update("locked.energy", v)}
                label="Protetto"
              />
              {isGroupLocked('energy') && (
                <Button variant="subtle" size="sm" onClick={() => handleUnlock('energy')}>
                  Sblocca
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Labeled label="% Autoconsumo con pompa di calore">
              <Input
                inputMode="decimal"
                value={local.pricing.selfConsumptionPctWithHeatPump}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,]*$/.test(v)) setLocal(l => ({ ...l, pricing: { ...l.pricing, selfConsumptionPctWithHeatPump: v } }));
                }}
                onBlur={e => {
                  let v = parseFloat(e.target.value.replace(",", "."));
                  if (isNaN(v)) v = 75;
                  v = Math.max(0, Math.min(100, v));
                  setLocal(l => ({
                    ...l,
                    pricing: {
                      ...l.pricing,
                      selfConsumptionPctWithHeatPump: String(v)
                    }
                  }));
                }}
                disabled={isGroupLocked('energy')}
              />
            </Labeled>
            <Labeled label="% Autoconsumo senza pompa di calore">
              <Input
                inputMode="decimal"
                value={local.pricing.selfConsumptionPctWithoutHeatPump}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,]*$/.test(v)) setLocal(l => ({ ...l, pricing: { ...l.pricing, selfConsumptionPctWithoutHeatPump: v } }));
                }}
                onBlur={e => {
                  let v = parseFloat(e.target.value.replace(",", "."));
                  if (isNaN(v)) v = 65;
                  v = Math.max(0, Math.min(100, v));
                  setLocal(l => ({
                    ...l,
                    pricing: {
                      ...l.pricing,
                      selfConsumptionPctWithoutHeatPump: String(v)
                    }
                  }));
                }}
                disabled={isGroupLocked('energy')}
              />
            </Labeled>
            <Labeled label="Prezzo vendita energia (CHF/kWh)">
              <Input
                inputMode="decimal"
                value={local.pricing.exportPriceCHFPerKWh}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,]*$/.test(v)) setLocal(l => ({ ...l, pricing: { ...l.pricing, exportPriceCHFPerKWh: v } }));
                }}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(",", "."));
                  setLocal(l => ({
                    ...l,
                    pricing: {
                      ...l.pricing,
                      exportPriceCHFPerKWh: isNaN(v) ? l.pricing.exportPriceCHFPerKWh : String(v)
                    }
                  }));
                }}
                disabled={isGroupLocked('energy')}
              />
            </Labeled>
          </div>
        </Card>
        
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Parametri Ambientali</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Labeled label="CO₂ risparmiata per kWh (kg)">
              <Input
                inputMode="decimal"
                value={local.environment.co2GridKgPerKWh}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,]*$/.test(v)) setLocal(l => ({ ...l, environment: { ...l.environment, co2GridKgPerKWh: v } }));
                }}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(",", "."));
                  setLocal(l => ({
                    ...l,
                    environment: {
                      ...l.environment,
                      co2GridKgPerKWh: isNaN(v) ? l.environment.co2GridKgPerKWh : String(v)
                    }
                  }));
                }}
              />
            </Labeled>
            <Labeled label="CO₂ assorbita da un albero all'anno (kg)">
              <Input
                inputMode="decimal"
                value={local.environment.co2PerTreeKgPerYear}
                onChange={e => {
                  const v = e.target.value;
                  if (/^[0-9.,]*$/.test(v)) setLocal(l => ({ ...l, environment: { ...l.environment, co2PerTreeKgPerYear: v } }));
                }}
                onBlur={e => {
                  const v = parseFloat(e.target.value.replace(",", "."));
                  setLocal(l => ({
                    ...l,
                    environment: {
                      ...l.environment,
                      co2PerTreeKgPerYear: isNaN(v) ? l.environment.co2PerTreeKgPerYear : String(v)
                    }
                  }));
                }}
              />
            </Labeled>
          </div>
        </Card>
        
        <div className="flex gap-2">
          <Button
            onClick={() => {
              // Normalizza pricing prima di salvare
              const arr = pvSizesText
                .split(/[;,\s]+/)
                .map(x => parseFloat(String(x).replace(",", ".")))
                .filter(x => !isNaN(x) && x > 0);
              const normLocal = JSON.parse(JSON.stringify(local));
              normLocal.pvSizesKW = arr;
              normLocal.pricing = normalizePricing(normLocal.pricing);
              normLocal.pricing.curvePricingEnabled = curveEnabled;
              normLocal.pricing.curve = normalizeCurve(normLocal.pricing.curve);
              setSettings(normLocal);
              saveSettings(normLocal);
            }}
          >
            Salva impostazioni
          </Button>
          <Button variant="ghost" onClick={() => setLocal(loadSettings())}>Annulla modifiche</Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSettings(DEFAULT_SETTINGS);
              saveSettings(DEFAULT_SETTINGS);
            }}
          >
            Ripristina predefiniti
          </Button>
        </div>
      </div>
      
      <PasswordModal
        isOpen={passwordModal.open}
        onClose={() => setPasswordModal({ open: false, group: null })}
        onSuccess={() => handlePasswordSuccess(passwordModal.group)}
      />
    </motion.div>
  );
}

function SectionHeader({ title }) {
  return <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{title}</div>;
}

function OfferSummary({ offer, stima }) {
  if (!stima || offer.type !== "install") return null;
  
  const s = offer.settingsSnapshot;
  const env = s.environment || DEFAULT_SETTINGS.environment;
  
  const co2Saved = stima.prod * (env.co2GridKgPerKWh || 0.12);
  const equivalentTrees = co2Saved / (env.co2PerTreeKgPerYear || 21);
  const paybackYears = stima.annualBenefit > 0 ? stima.totalNet / stima.annualBenefit : 0;
  
  return (
    <Card className="mb-6">
      <SectionHeader title="Riepilogo Impianto Fotovoltaico" />
      <div className="text-sm space-y-3">
        <p>
          L'impianto fotovoltaico proposto ha una potenza di <b>{number(stima.kw, 1)} kW</b> 
          e produrrà circa <b>{number(stima.prod, 0)} kWh all'anno</b>, equivalenti al consumo 
          energetico annuo di un'abitazione di medie dimensioni.
        </p>
        
        <p>
          Grazie alla presenza di {offer.computed.heatPump ? "una pompa di calore" : "un sistema di accumulo"}, 
          si stima un autoconsumo del <b>{number(stima.autoPct * 100, 0)}%</b> ({number(stima.autoKWh, 0)} kWh), 
          mentre i rimanenti <b>{number(stima.gridKWh, 0)} kWh</b> verranno immessi in rete, 
          generando un ulteriore introito.
        </p>
        
        <p>
          Il beneficio economico annuo stimato è di <b>{currency(stima.annualBenefit)}</b>, 
          derivante dal risparmio sull'energia autoconsumata ({currency(stima.valueAuto)}) 
          e dalla vendita dell'energia in eccesso ({currency(stima.valueExport)}). 
          Il tempo di ritorno dell'investimento è stimato in <b>{number(paybackYears, 1)} anni</b>.
        </p>
        
        <p>
          Dal punto di vista ambientale, l'impianto eviterà l'emissione di <b>{number(co2Saved, 0)} kg</b> di CO₂ all'anno, 
          equivalenti all'assorbimento di <b>{number(equivalentTrees, 0)} alberi</b> maturi.
        </p>
      </div>
    </Card>
  );
}

function OfferView({ offer, onNew, onEdit }) {
  const ref = useRef(null);
  const date = new Date(offer.createdAt);
  const isInstall = offer.type === "install";

  // Sconto solo per venditore
  const [discountPct, setDiscountPct] = useState(0);

  // Calcoli stima economica (solo install)
  let stima = null;
  if (isInstall) {
    const s = offer.settingsSnapshot;
    const kw = parseFloat(String(offer.computed.selectedKW).replace(',', '.')) || (offer.computed.suggestedSizesKW?.[1] ?? 0);
    let unit = 0;
    if (s.pricing.curvePricingEnabled) {
      unit = pricePerKWFromCurve(kw, s.pricing.curve);
    } else {
      unit = parseFloat(String(s.pricing.systemPricePerKWCHF).replace(',', '.')) || 0;
    }
    const subtotal = kw * unit;
    const discountVal = subtotal * (discountPct / 100);
    const vatPct = parseFloat(String(s.pricing.vatPercent).replace(',', '.')) || 0;
    const vat = (subtotal - discountVal) * vatPct / 100;
    const totalBeforeIncentives = subtotal - discountVal + vat;
    const inc = s.pricing.incentives || {};
    const incFed  = kw * (parseFloat(String(inc.federalCHFPerKW).replace(',', '.'))   || 0);
    const incCant = kw * (parseFloat(String(inc.cantonalCHFPerKW).replace(',', '.'))  || 0);
    const incMun  = kw * (parseFloat(String(inc.municipalCHFPerKW).replace(',', '.')) || 0);
    const totalNet = Math.max(0, totalBeforeIncentives - incFed - incCant - incMun);

    // Rendimento energetico stimato
    const prod = (kw || 0) * 1000;
    const autoPct = (
      offer.computed.heatPump
        ? (parseFloat(String(s.pricing.selfConsumptionPctWithHeatPump).replace(',', '.')) || 0)
        : (parseFloat(String(s.pricing.selfConsumptionPctWithoutHeatPump).replace(',', '.')) || 0)
    ) / 100;
    const autoKWh = prod * autoPct;
    const gridKWh = Math.max(0, prod - autoKWh);
    const buyPrice    = parseFloat(String(s.pricing.energyPriceCHFPerKWh).replace(',', '.')) || 0;
    const exportPrice = parseFloat(String(s.pricing.exportPriceCHFPerKWh).replace(',', '.')) || 0;
    const valueAuto   = autoKWh * buyPrice;
    const valueExport = gridKWh * exportPrice;
    const annualBenefit = valueAuto + valueExport;

    stima = {
      kw, unit, subtotal, discountVal, vatPct, vat, totalBeforeIncentives,
      incFed, incCant, incMun, totalNet, discountPct,
      prod, autoPct, autoKWh, gridKWh, valueAuto, valueExport, annualBenefit
    };
  }

  const rendimentoTable = stima && (
    <Card className="mt-6">
      <SectionHeader title="Rendimento energetico stimato" />
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td>Produzione stimata</td>
            <td>{number(stima.prod, 0)} kWh/anno</td>
          </tr>
          <tr>
            <td>Autoconsumo</td>
            <td>{number(stima.autoPct * 100, 0)}%</td>
          </tr>
          <tr>
            <td>kWh autoconsumati</td>
            <td>{number(stima.autoKWh, 0)} kWh</td>
          </tr>
          <tr>
            <td>kWh immessi in rete</td>
            <td>{number(stima.gridKWh, 0)} kWh</td>
          </tr>
          <tr>
            <td>Valore autoconsumo</td>
            <td>{currency(stima.valueAuto)}</td>
          </tr>
          <tr>
            <td>Valore energia immessa</td>
            <td>{currency(stima.valueExport)}</td>
          </tr>
          <tr>
            <td className="font-semibold">Beneficio annuo estimato</td>
            <td className="font-semibold">{currency(stima.annualBenefit)}</td>
          </tr>
        </tbody>
      </table>
    </Card>
  );

  const doPrint = () => {
    window.print();
  };

  const doExportPdf = async () => {
    try {
      // Crea un elemento nascosto per il PDF
      const pdfElement = document.createElement('div');
      pdfElement.className = 'pdf-container';
      pdfElement.style.width = '210mm';
      pdfElement.style.padding = '10mm';
      pdfElement.style.margin = '0 auto';
      pdfElement.style.backgroundColor = 'white';
      pdfElement.style.color = 'black';
      
      // Clona il contenuto della copia cliente
      const clientCopy = document.querySelector('.client-copy');
      if (clientCopy) {
        const clone = clientCopy.cloneNode(true);
        pdfElement.appendChild(clone);
      }
      
      // Aggiungi al DOM temporaneamente
      pdfElement.style.position = 'absolute';
      pdfElement.style.left = '-9999px';
      document.body.appendChild(pdfElement);
      
      // Esporta come PDF
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `offerta-${offer.offerRef}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      const worker = html2pdf().set(opt).from(pdfElement);
      const blob = await worker.outputPdf('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Salva il PDF nel database
      await savePdfToDB(offer.offerRef, blob);
      
      // Rimuovi l'elemento temporaneo
      document.body.removeChild(pdfElement);
    } catch (error) {
      console.error('Errore durante esportazione PDF:', error);
      alert('Si è verificato un errore durante la generazione del PDF');
    }
  };

  const vendorCopy = (
    <>
      <OfferDoc offer={offer} audience="vendor" />
      {isInstall && (
        <>
          <Card className="mt-6">
            <SectionHeader title="Stima economica" />
            <div className="mb-2 flex items-center gap-3">
              <label className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">
                Sconto %
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={0.5}
                  value={discountPct}
                  onChange={e => {
                    let v = parseFloat(e.target.value.replace(",", "."));
                    if (isNaN(v)) v = 0;
                    if (v < 0) v = 0;
                    if (v > 30) v = 30;
                    setDiscountPct(v);
                  }}
                  className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
                  style={{ verticalAlign: "middle" }}
                />
              </label>
            </div>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td>Taglia selezionata</td>
                  <td className="font-medium">{number(stima.kw, 1)} kW</td>
                </tr>
                <tr>
                  <td>Prezzo unitario</td>
                  <td>{currency(stima.unit)}</td>
                </tr>
                <tr>
                  <td>Subtotale</td>
                  <td>{currency(stima.subtotal)}</td>
                </tr>
                <tr>
                  <td>Sconto</td>
                  <td>{currency(stima.discountVal)} ({number(stima.discountPct, 1)}%)</td>
                </tr>
                <tr>
                  <td>IVA</td>
                  <td>{number(stima.vatPct, 1)}%</td>
                </tr>
                <tr>
                  <td className="font-medium">Totale (IVA incl.)</td>
                  <td className="font-medium">{currency(stima.totalBeforeIncentives)}</td>
                </tr>
                <tr>
                  <td>Incentivo federale</td>
                  <td>{currency(-stima.incFed)}</td>
                </tr>
                <tr>
                  <td>Incentivo cantonale</td>
                  <td>{currency(-stima.incCant)}</td>
                </tr>
                <tr>
                  <td>Incentivo comunale</td>
                  <td>{currency(-stima.incMun)}</td>
                </tr>
                <tr>
                  <td className="font-semibold">Totale netto dopo incentivi</td>
                  <td className="font-semibold">{currency(stima.totalNet)}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-2">
              <span className="text-xs text-zinc-500">
                L'incentivo comunale è indicativo e può variare; la conferma avverrà dopo verifica presso il Comune.
              </span>
            </div>
          </Card>
          {rendimentoTable}
        </>
      )}
    </>
  );

  const clientCopy = (
    <div className="client-copy">
      <OfferSummary offer={offer} stima={stima} />
      <OfferDoc offer={offer} audience="client" />
      {isInstall && (
        <>
          <Card className="mt-6">
            <SectionHeader title="Stima economica" />
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td>Taglia selezionata</td>
                  <td className="font-medium">{number(stima.kw, 1)} kW</td>
                </tr>
                <tr>
                  <td>Prezzo unitario</td>
                  <td>{currency(stima.unit)}</td>
                </tr>
                <tr>
                  <td>Subtotale</td>
                  <td>{currency(stima.subtotal)}</td>
                </tr>
                {stima.discountPct > 0 && (
                  <tr>
                    <td>Sconto</td>
                    <td>{currency(stima.discountVal)} ({number(stima.discountPct, 1)}%)</td>
                  </tr>
                )}
                <tr>
                  <td>IVA</td>
                  <td>{number(stima.vatPct, 1)}%</td>
                </tr>
                <tr>
                  <td className="font-medium">Totale (IVA incl.)</td>
                  <td className="font-medium">{currency(stima.totalBeforeIncentives)}</td>
                </tr>
                <tr>
                  <td>Incentivo federale</td>
                  <td>{currency(-stima.incFed)}</td>
                </tr>
                <tr>
                  <td>Incentivo cantonale</td>
                  <td>{currency(-stima.incCant)}</td>
                </tr>
                <tr>
                  <td>Incentivo comunale</td>
                  <td>{currency(-stima.incMun)}</td>
                </tr>
                <tr>
                  <td className="font-semibold">Totale netto dopo incentivi</td>
                  <td className="font-semibold">{currency(stima.totalNet)}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-2">
              <span className="text-xs text-zinc-500">
                L'incentivo comunale è indicativo e può variare; la conferma avverrà dopo verifica presso il Comune.
              </span>
            </div>
          </Card>
          {rendimentoTable}
        </>
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Offerta {offer.offerRef} · {date.toLocaleDateString("it-CH")}</h2>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onEdit}>Modifica dati</Button>
          <Button icon={Printer} onClick={doPrint}>Stampa</Button>
          <Button icon={FileText} onClick={doExportPdf}>Esporta PDF</Button>
          <Button variant="ghost" onClick={onNew}>Nuova offerta</Button>
        </div>
      </div>

      <div className="grid gap-6 print:block">
        <Card className="print:shadow-none">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-semibold">Copia per il venditore</div>
            <span className="text-xs text-zinc-500">Uso interno</span>
          </div>
          {vendorCopy}
        </Card>
        <Card className="print:break-before-page print:shadow-none">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-semibold">Copia per il cliente</div>
            <span className="text-xs text-zinc-500">Da consegnare al cliente</span>
          </div>
          {clientCopy}
        </Card>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          html, body { background: white !important; }
          .print\\:block { display: block !important; }
          .print\\:break-before-page { break-before: page; }
          .print\\:shadow-none { box-shadow: none !important; }
          .rounded-2xl, .rounded-xl { border-radius: 0 !important; }
          .border { border: none !important; }
          .bg-white, .dark\\:bg-zinc-900 { background: white !important; }
        }
      `}</style>
    </motion.div>
  );
}

function OfferDoc({ offer, audience }) {
  const s = offer.settingsSnapshot;
  const c = offer.customer;
  const isInstall = offer.type === "install";

  return (
    <div className="grid gap-4 text-sm">
      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <img src={import.meta.env.BASE_URL + "img/logoedil.png"} alt="Edil Repairs" className="h-10 w-auto object-contain" />
            <div>
              <div className="text-base font-semibold">{s.company.name}</div>
              <div className="text-xs text-zinc-500">{s.company.address} · {s.company.phone} · {s.company.email}</div>
            </div>
          </div>
          <div className="mt-3">
            <SectionHeader title="Destinatario" />
            <div>{c.firstName} {c.lastName}</div>
            <div>{c.street}</div>
            <div>{c.cap} {c.city} · {c.country}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">Data</div>
          <div className="font-medium">{new Date(offer.createdAt).toLocaleDateString("it-CH")}</div>
          <div className="mt-2 text-xs text-zinc-500">Rif. offerta</div>
          <div className="font-mono text-[13px]">{offer.offerRef}</div>
        </div>
      </header>

      <div className="grid gap-3">
        {isInstall ? (
          <>
            <SectionHeader title="Proposta impianto FV" />
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-zinc-500">
                  <th className="py-1">Descrizione</th>
                  <th className="py-1">Valore</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-1">Consumo annuo stimato</td>
                  <td className="py-1">{number(offer.computed.annualKWh, 0)} kWh</td>
                </tr>
                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-1">Prezzo energia considerato</td>
                  <td className="py-1">{number(offer.computed.energyPriceCHFPerKWh, 2)} CHF/kWh</td>
                </tr>
                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-1">Pompa di calore</td>
                  <td className="py-1">{offer.computed.heatPump ? "Sì" : "No"}</td>
                </tr>
                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-1">Taglie suggerite</td>
                  <td className="py-1">{offer.computed.suggestedSizesKW.map((x) => `${x} kW`).join(" · ")}</td>
                </tr>
              </tbody>
            </table>
            <div className="text-xs text-zinc-500">
              Nota: dimensionamento indicativo basato su 1 kWp ≈ 1000 kWh/anno; taglie finali e prezzi da definire dopo sopralluogo.
            </div>
          </>
        ) : (
          <>
            <SectionHeader title="Intervento di manutenzione / pulizia" />
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-zinc-500">
                  <th className="py-1">Voce</th>
                  <th className="py-1">Valore</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-1">N° pannelli</td>
                  <td className="py-1">{offer.computed.panels}</td>
                </tr>
                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-1">Totale (IVA inclusa)</td>
                  <td className="py-1 font-medium">{currency(offer.computed.gross)}</td>
                </tr>
              </tbody>
            </table>
            {offer.customer.extraNotes && (
              <div className="mt-2 text-sm"><span className="text-zinc-500">Note:</span> {offer.customer.extraNotes}</div>
            )}
            <div className="text-xs text-zinc-500">Calcolo interno con tariffa amministratore e IVA impostata.</div>
          </>
        )}
      </div>

      <div className="mt-4 grid gap-1 text-xs text-zinc-500">
        <div>Condizioni: offerta non vincolante. Validità 30 giorni salvo diversa indicazione. Installazione/manutenzione soggetta a sopralluogo.</div>
        <div>Per domande: {s.company.phone} · {s.company.email}</div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="text-xs text-zinc-500">Firma venditore</div>
          <div className="h-12" />
        </div>
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="text-xs text-zinc-500">Firma cliente</div>
          <div className="h-12" />
        </div>
      </div>
    </div>
  );
}

function ArchiveView({ onSelectOffer }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    try {
      const offerList = await listOffersFromDB();
      setOffers(offerList);
    } catch (error) {
      console.error('Errore nel caricamento offerte:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOffer = async (offerRef) => {
    if (window.confirm('Sei sicuro di voler eliminare questa offerta?')) {
      await deleteOfferFromDB(offerRef);
      await loadOffers();
    }
  };

  const handleDownloadJson = async (offerRef) => {
    try {
      const offer = await getOfferFromDB(offerRef);
      const dataStr = JSON.stringify(offer, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `prg/${offerRef}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Errore nel download JSON:', error);
      alert('Errore nel download del file JSON');
    }
  };

  const handleDownloadPdf = async (offerRef) => {
    try {
      const pdfBlob = await getPdfFromDB(offerRef);
      if (!pdfBlob) {
        alert('Nessun PDF trovato per questa offerta');
        return;
      }
      
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `prg-pdf/${offerRef}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Errore nel download PDF:', error);
      alert('Errore nel download del file PDF');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Caricamento archivio...</div>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Archivio Offerte</h1>
        <Button onClick={loadOffers}>Aggiorna</Button>
      </div>

      {offers.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-zinc-500">
            Nessuna offerta salvata nell'archivio
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {offers.map((offer) => (
            <Card key={offer.offerRef}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{offer.offerRef}</h3>
                  <p className="text-sm text-zinc-500">
                    {new Date(offer.createdAt).toLocaleDateString('it-CH')} · 
                    {offer.type === 'install' ? ' Nuovo impianto' : ' Manutenzione'} · 
                    {offer.customer.firstName} {offer.customer.lastName}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="subtle" size="sm" onClick={() => onSelectOffer(offer)}>
                    Apri
                  </Button>
                  <Button variant="subtle" size="sm" onClick={() => handleDownloadJson(offer.offerRef)}>
                    Scarica JSON
                  </Button>
                  <Button variant="subtle" size="sm" onClick={() => handleDownloadPdf(offer.offerRef)}>
                    Scarica PDF
                  </Button>
                  <Button variant="subtle" size="sm" onClick={() => handleDeleteOffer(offer.offerRef)}>
                    Elimina
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Footer({ company }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-200 bg-white/80 px-4 py-2 text-center text-xs text-zinc-500 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/75">
      © {new Date().getFullYear()} {company.name} · Pronto per stampa/PDF · Dati salvati in locale
    </div>
  );
}
