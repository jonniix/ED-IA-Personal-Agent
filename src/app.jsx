import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sun, Moon, Wrench, PlugZap, Settings, Home, FileText, Printer, Archive } from "lucide-react";
import { saveOfferToDB, getOfferFromDB, listOffersFromDB, deleteOfferFromDB, savePdfToDB, getPdfFromDB } from "../lib/db";
import CatalogEditor from "./ai/CatalogEditor.jsx";
import AIWizard from "./ai/AIWizard.jsx";

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
    logoText: "i.Solar",
    address: "Viale Officina 21, 6500 Bellinzona",
    phone: "+41 91 835 50 80",
    email: "info@edilrepairs.ch",
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
    selfConsumptionPctWithHeatPump: 70,
    selfConsumptionPctWithoutHeatPump: 60,
    exportPriceCHFPerKWh: 0.05,
  },
  environment: {
    co2GridKgPerKWh: 0.12,
    co2PerTreeKgPerYear: 21
  },
  pvSizesKW: [8, 10, 12, 14, 16, 25, 35, 50, 70, 100, 135, 200],
  wallboxPricing: {
    base: { presa: 200, standard: 850, smart: 1200 },
    powerAddon: { "11": 0, "22": 250 },
    distanceBand: { "0-5": 150, "5-10": 250, "10-25": 450, "25-50": 800 }
  },
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
  ai: {
    calloutFixedCHF: 135,
    billTravelAs: "fixed",
    travelCHFPerMinute: 2.0,
    defaultOneWayTravelMinutes: 20,
    roundLaborToQuarterHour: true,
    electricianCHFh: 95,
    apprenticeCHFh: 55,
    vatPercentOverride: null,
    timePerTaskMinutes: {
      "Illuminazione": { base: 20, ext: 10, pareteExtra: 5 },
      "Prese/Interruttori": { basePerPresa: 30, dimmerExtra: 10 },
      "Quadro Elettrico": { adeguamento: 120, sostituzione: 240, linea: 60 },
      "Citofonia/Video": { citofono: 90, videocitofono: 120 },
      "Rete Dati": { presa: 30, accessPoint: 45, rack: 60 },
      "EV/Wallbox": { sopralluogo: 45, posa: 120 },
      "Altro": { base: 60 }
    },
    materialCatalog: {
      "Illuminazione": [
        { key:"plafoniera_semplice", descr:"Plafoniera LED semplice", unitCHF:65 },
        { key:"plafoniera_esterno",  descr:"Plafoniera IP65 esterno", unitCHF:95 }
      ],
      "Prese/Interruttori": [
        { key:"presa_schuko", descr:"Presa Schuko 16A", unitCHF:12 },
        { key:"interruttore", descr:"Interruttore 1P",  unitCHF:10 },
        { key:"dimmer",       descr:"Dimmer luce",      unitCHF:45 }
      ],
      "EV/Wallbox": [
        { key:"wb_standard", descr:"Wallbox standard", unitCHF:850 },
        { key:"wb_smart",    descr:"Wallbox smart",    unitCHF:1250 }
      ]
    }
  },
  aiConfig: {
    companyHQ: "Viale Officina 21, 6500 Bellinzona, Ticino",
    rates: {
      hourlyWorker: 95,
      hourlyApprentice: 55,
      calloutFee: 135,
      travelRatePerMinute: 0
    },
    taskTimesMin: {
      plafoniera: 20,
      applique: 18,
      farettiIncasso: 25,
      presa: 15,
      interruttore: 12,
      dimmer: 18,
      citofono: 60,
      videocitofono: 90,
      lineaDatiRJ45: 30
    },
    materialsCHF: {
      plafonieraSemplice: 80,
      presaSchuko: 18,
      interruttore: 14,
      dimmer: 45,
      cavoAlMetro: 2.2,
      minuteraForfait: 12
    },
    defaults: {
      travelMinutesOneWayLocal: 15,
      travelMinutesOneWayExtra: 35
    },
    autoApplyCallout: true // <--- nuovo toggle
  },
  locked: {
    company: false,
    pricing: false,
    curve: false,
    incentives: false,
    energy: false,
    wallbox: false,
    ai: false
  }
};

const loadSettings = () => {
  try {
    const raw = localStorage.getItem("pv_event_toolkit_settings");
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      company: { ...DEFAULT_SETTINGS.company, ...(parsed.company || {}) },
      pricing: { ...DEFAULT_SETTINGS.pricing, ...(parsed.pricing || {}) },
      environment: { ...DEFAULT_SETTINGS.environment, ...(parsed.environment || {}) },
      capToCity: { ...DEFAULT_SETTINGS.capToCity, ...(parsed.capToCity || {}) },
      pvSizesKW: parsed.pvSizesKW || DEFAULT_SETTINGS.pvSizesKW,
      wallboxPricing: { ...DEFAULT_SETTINGS.wallboxPricing, ...(parsed.wallboxPricing || {}) },
      ai: { ...DEFAULT_SETTINGS.ai, ...(parsed.ai || {}) },
      aiConfig: { ...DEFAULT_SETTINGS.aiConfig, ...(parsed.aiConfig || {}) },
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
  const [route, setRoute] = useState("home"); // home | new | maint | admin | offer | archive | wallbox | ai
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
  const [wallboxForm, setWallboxForm] = useState({
    firstName: "",
    lastName: "",
    street: "",
    cap: "",
    city: "",
    country: "Svizzera",
    phone: "",
    email: "",
    chargerKW: "11",
    distanceBand: "0-5",
    chargerType: "presa"
  });

  const [offer, setOffer] = useState(loadOffer());
  const [unlockedGroups, setUnlockedGroups] = useState(() => {
    const stored = sessionStorage.getItem('pv_unlocked_groups');
    return stored ? JSON.parse(stored) : {};
  });
  const [aiOpenOffer, setAiOpenOffer] = useState(null);

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

  // Auto-lookup City from CAP
  useEffect(() => {
    const cap = wallboxForm.cap?.trim();
    if (cap && settings.capToCity[cap]) {
      setWallboxForm((f) => ({ ...f, city: settings.capToCity[cap] }));
    }
  }, [wallboxForm.cap, settings.capToCity]);

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

  // Funzione per creare offerta Wallbox
  const buildWallboxOffer = () => {
    const offerRef = nextOfferRef();
    const payload = {
      type: "wallbox",
      offerRef,
      createdAt: new Date().toISOString(),
      customer: wallboxForm,
      computed: {
        chargerKW: Number(wallboxForm.chargerKW || 11),
        distanceBand: wallboxForm.distanceBand,
        chargerType: wallboxForm.chargerType
        // prezzi/calcoli arriveranno nel Passo 3
      },
      settingsSnapshot: settings,
    };
    setOffer(payload);
    saveOffer(payload);
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

  // Handler per aprire bozza AI dall'archivio o home
  function handleSelectOffer(offer) {
    if (offer.type === "service") {
      setAiOpenOffer(offer);
      setRoute("ai");
    } else {
      setOffer(offer);
      saveOffer(offer);
      setRoute("offer");
    }
  }

  useEffect(() => {
    if (route === "ai_open_last") {
      // Cerca ultima bozza AI
      listOffersFromDB().then(list => {
        const last = [...list].reverse().find(o => o.type === "service");
        if (last) {
          setAiOpenOffer(last);
          setRoute("ai");
        } else {
          alert("Nessuna bozza AI trovata.");
          setRoute("home");
        }
      });
    }
  }, [route]);

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
            onEdit={() => {
              const t = offer?.type;
              if (t === "install") setRoute("new");
              else if (t === "maintenance") setRoute("maint");
              else if (t === "wallbox") setRoute("wallbox");
              else if (t === "service") setRoute("ai");
              else setRoute("home");
            }}
          />
        )}
        {route === "archive" && (
          <ArchiveView
            onSelectOffer={handleSelectOffer}
          />
        )}
        {route === "wallbox" && (
          <WallboxForm
            form={wallboxForm}
            setForm={setWallboxForm}
            settings={settings}
            onCreate={buildWallboxOffer}
          />
        )}
        {route === "ai" && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <AIWizard
              settings={settings}
              setRoute={setRoute}
            />
          </motion.div>
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

function Button({ children, onClick, variant = "primary", icon: Icon, className = "", type = "button", size = "md" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition active:translate-y-[1px]";
  const sizes = {
    md: "px-4 py-2",
    sm: "px-3 py-1.5 text-xs rounded-lg",
  };
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-sm",
    ghost: "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
    subtle: "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700",
  };
  return (
    <button type={type} onClick={onClick} className={[base, sizes[size] || sizes.md, variants[variant], className].join(" ")}>
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
        {/* Card FV */}
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
        {/* Card Manutenzione */}
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
        {/* Card Wallbox */}
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">Wallbox</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Offerta per installazione Wallbox di ricarica veicoli elettrici.
              </p>
            </div>
            <div className="rounded-xl bg-purple-600/10 p-3 text-purple-600 dark:text-purple-400">
              <PlugZap />
            </div>
          </div>
          <div className="mt-4">
            <Button icon={PlugZap} onClick={() => setRoute("wallbox")}>Avvia</Button>
          </div>
        </Card>
        {/* Card AI Preventivi */}
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">Assistente AI (preventivo rapido)</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Preventivo rapido con stima tempi, materiali e viaggio. Nessuna chiamata esterna.
              </p>
            </div>
            <div className="rounded-xl bg-fuchsia-600/10 p-3 text-fuchsia-600 dark:text-fuchsia-400">
              <Settings />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button icon={Settings} onClick={() => setRoute("ai")}>Avvia</Button>
            <Button variant="ghost" onClick={() => setRoute("ai_open_last")}>Apri ultima bozza</Button>
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
    // Wallbox prezzi: string-first
    if (!s.wallboxPricing) s.wallboxPricing = { base: {}, powerAddon: {}, distanceBand: {} };
    s.wallboxPricing.base.presa = String(s.wallboxPricing.base?.presa ?? 200);
    s.wallboxPricing.base.standard = String(s.wallboxPricing.base?.standard ?? 850);
    s.wallboxPricing.base.smart = String(s.wallboxPricing.base?.smart ?? 1200);
    s.wallboxPricing.powerAddon["11"] = String(s.wallboxPricing.powerAddon?.["11"] ?? 0);
    s.wallboxPricing.powerAddon["22"] = String(s.wallboxPricing.powerAddon?.["22"] ?? 250);
    s.wallboxPricing.distanceBand["0-5"] = String(s.wallboxPricing.distanceBand?.["0-5"] ?? 150);
    s.wallboxPricing.distanceBand["5-10"] = String(s.wallboxPricing.distanceBand?.["5-10"] ?? 250);
    s.wallboxPricing.distanceBand["10-25"] = String(s.wallboxPricing.distanceBand?.["10-25"] ?? 450);
    s.wallboxPricing.distanceBand["25-50"] = String(s.wallboxPricing.distanceBand?.["25-50"] ?? 800);
    // AI: string-first
    if (!s.ai) s.ai = {};
    s.ai.calloutFixedCHF = String(s.ai.calloutFixedCHF ?? 135);
    s.ai.billTravelAs = s.ai.billTravelAs ?? "fixed";
    s.ai.travelCHFPerMinute = String(s.ai.travelCHFPerMinute ?? 2.0);
    s.ai.defaultOneWayTravelMinutes = String(s.ai.defaultOneWayTravelMinutes ?? 20);
    s.ai.roundLaborToQuarterHour = !!s.ai.roundLaborToQuarterHour;
    s.ai.electricianCHFh = String(s.ai.electricianCHFh ?? 95);
    s.ai.apprenticeCHFh = String(s.ai.apprenticeCHFh ?? 55);
    s.ai.vatPercentOverride = s.ai.vatPercentOverride !== null ? String(s.ai.vatPercentOverride) : "";
    // timePerTaskMinutes: string-first
    Object.entries(DEFAULT_SETTINGS.ai.timePerTaskMinutes).forEach(([cat, obj]) => {
      if (!s.ai.timePerTaskMinutes) s.ai.timePerTaskMinutes = {};
      if (!s.ai.timePerTaskMinutes[cat]) s.ai.timePerTaskMinutes[cat] = {};
      Object.entries(obj).forEach(([k, v]) => {
        s.ai.timePerTaskMinutes[cat][k] = String(s.ai.timePerTaskMinutes[cat]?.[k] ?? v);
      });
    });
    // materialCatalog: string-first
    Object.entries(DEFAULT_SETTINGS.ai.materialCatalog).forEach(([cat, arr]) => {
      if (!s.ai.materialCatalog) s.ai.materialCatalog = {};
      if (!s.ai.materialCatalog[cat]) s.ai.materialCatalog[cat] = [];
      s.ai.materialCatalog[cat] = arr.map((mat, idx) => {
        const existing = s.ai.materialCatalog[cat][idx] || {};
        return {
          key: existing.key ?? mat.key,
          descr: existing.descr ?? mat.descr,
          unitCHF: String(existing.unitCHF ?? mat.unitCHF)
        };
      });
    });
    // aiConfig: string-first
    if (!s.aiConfig) s.aiConfig = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.aiConfig));
    s.aiConfig.companyHQ = s.aiConfig.companyHQ ?? DEFAULT_SETTINGS.aiConfig.companyHQ;
    Object.entries(DEFAULT_SETTINGS.aiConfig.rates).forEach(([k, v]) => {
      if (!s.aiConfig.rates) s.aiConfig.rates = {};
      s.aiConfig.rates[k] = String(s.aiConfig.rates?.[k] ?? v);
    });
    Object.entries(DEFAULT_SETTINGS.aiConfig.taskTimesMin).forEach(([k, v]) => {
      if (!s.aiConfig.taskTimesMin) s.aiConfig.taskTimesMin = {};
      s.aiConfig.taskTimesMin[k] = String(s.aiConfig.taskTimesMin?.[k] ?? v);
    });
    Object.entries(DEFAULT_SETTINGS.aiConfig.materialsCHF).forEach(([k, v]) => {
      if (!s.aiConfig.materialsCHF) s.aiConfig.materialsCHF = {};
      s.aiConfig.materialsCHF[k] = String(s.aiConfig.materialsCHF?.[k] ?? v);
    });
    Object.entries(DEFAULT_SETTINGS.aiConfig.defaults).forEach(([k, v]) => {
      if (!s.aiConfig.defaults) s.aiConfig.defaults = {};
      s.aiConfig.defaults[k] = String(s.aiConfig.defaults?.[k] ?? v);
    });
    if (typeof s.aiConfig.autoApplyCallout === "undefined") s.aiConfig.autoApplyCallout = true;
    return s;
  });

  // Defensive ensure aiCatalog always present
  React.useEffect(() => {
    if (!local.aiCatalog) {
      setLocal(prev => ({
        ...prev,
        aiCatalog: (prev.aiCatalog ?? (typeof DEFAULT_SETTINGS !== "undefined" ? DEFAULT_SETTINGS.aiCatalog : {}))
      }));
    }
  }, [local.aiCatalog]);

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
      municipalCHFPerKW: parseField(municipalIncentive, settings.pricing.incentives?.municipalCHFPerKW ?? 10),
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
      minKW: parseInt(curveMinKW) || 8,
      priceAtMin: parseFloat(String(curvePriceAtMin).replace(",", ".")) || 2000,
      maxKW: parseInt(curveMaxKW) || 200,
      priceAtMax: parseFloat(String(curvePriceAtMax).replace(",", ".")) || 1000,
    };
  };

  // Normalizza wallboxPricing su blur/salva
  const normalizeWallboxPricing = (wallboxPricing) => {
    const norm = { base: {}, powerAddon: {}, distanceBand: {} };
    norm.base.presa = parseFloat(String(wallboxPricing.base.presa).replace(",", ".")) || 0;
    norm.base.standard = parseFloat(String(wallboxPricing.base.standard).replace(",", ".")) || 0;
    norm.base.smart = parseFloat(String(wallboxPricing.base.smart).replace(",", ".")) || 0;
    norm.powerAddon["11"] = parseFloat(String(wallboxPricing.powerAddon["11"]).replace(",", ".")) || 0;
    norm.powerAddon["22"] = parseFloat(String(wallboxPricing.powerAddon["22"]).replace(",", ".")) || 0;
    norm.distanceBand["0-5"] = parseFloat(String(wallboxPricing.distanceBand["0-5"]).replace(",", ".")) || 0;
    norm.distanceBand["5-10"] = parseFloat(String(wallboxPricing.distanceBand["5-10"]).replace(",", ".")) || 0;
    norm.distanceBand["10-25"] = parseFloat(String(wallboxPricing.distanceBand["10-25"]).replace(",", ".")) || 0;
    norm.distanceBand["25-50"] = parseFloat(String(wallboxPricing.distanceBand["25-50"]).replace(",", ".")) || 0;
    return norm;
  };

  // Normalizza ai su blur/salva
  const normalizeAi = (ai) => {
    const norm = { ...ai };
    norm.calloutFixedCHF = parseFloat(String(ai.calloutFixedCHF).replace(",", ".")) || 0;
    norm.billTravelAs = ai.billTravelAs || "fixed";
    norm.travelCHFPerMinute = parseFloat(String(ai.travelCHFPerMinute).replace(",", ".")) || 0;
    norm.defaultOneWayTravelMinutes = parseFloat(String(ai.defaultOneWayTravelMinutes).replace(",", ".")) || 0;
    norm.roundLaborToQuarterHour = !!ai.roundLaborToQuarterHour;
    norm.electricianCHFh = parseFloat(String(ai.electricianCHFh).replace(",", ".")) || 0;
    norm.apprenticeCHFh = parseFloat(String(ai.apprenticeCHFh).replace(",", ".")) || 0;
    norm.vatPercentOverride = ai.vatPercentOverride !== "" && ai.vatPercentOverride !== null
      ? parseFloat(String(ai.vatPercentOverride).replace(",", ".")) : null;
    // timePerTaskMinutes
    Object.entries(ai.timePerTaskMinutes || {}).forEach(([cat, obj]) => {
      Object.entries(obj).forEach(([k, v]) => {
        norm.timePerTaskMinutes[cat][k] = parseFloat(String(v).replace(",", ".")) || 0;
      });
    });
    // materialCatalog
    Object.entries(ai.materialCatalog || {}).forEach(([cat, arr]) => {
      norm.materialCatalog[cat] = arr.map(mat => ({
        key: mat.key,
        descr: mat.descr,
        unitCHF: parseFloat(String(mat.unitCHF).replace(",", ".")) || 0
      }));
    });
    return norm;
  };

  // Normalizza aiConfig su blur/salva
  const normalizeAiConfig = (aiConfig) => {
    const norm = { ...aiConfig };
    norm.companyHQ = aiConfig.companyHQ ?? DEFAULT_SETTINGS.aiConfig.companyHQ;
    norm.rates = {};
    Object.entries(aiConfig.rates || {}).forEach(([k, v]) => {
      norm.rates[k] = parseFloat(String(v).replace(",", ".")) || 0;
    });
    norm.taskTimesMin = {};
    Object.entries(aiConfig.taskTimesMin || {}).forEach(([k, v]) => {
      norm.taskTimesMin[k] = parseFloat(String(v).replace(",", ".")) || 0;
    });
    norm.materialsCHF = {};
    Object.entries(aiConfig.materialsCHF || {}).forEach(([k, v]) => {
      norm.materialsCHF[k] = parseFloat(String(v).replace(",", ".")) || 0;
    });
    norm.defaults = {};
    Object.entries(aiConfig.defaults || {}).forEach(([k, v]) => {
      norm.defaults[k] = parseFloat(String(v).replace(",", ".")) || 0;
    });
    return norm;
  };

  // Deep setter for update(path, value)
  const update = (path, value) => {
    const next = JSON.parse(JSON.stringify(local));
    const segs = path.split(".");
    let cur = next;
    for (let i = 0; i < segs.length - 1; i++) {
      const k = segs[i];
      if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
      cur = cur[k];
    }
    cur[segs[segs.length - 1]] = value;
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
        <Button variant="subtle" size="sm" onClick={() => {
          const el = document.getElementById("admin-ai-catalogo");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }}>
          Vai a Catalogo AI
        </Button>
      </div>
      <div className="grid gap-4">
        {/* --- Catalogo AI card: fixed JSX nesting --- */}
        <Card id="admin-ai-catalogo" data-testid="admin-ai-catalogo">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Assistente AI · Catalogo prezzi/tempi
            </h3>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={settings.locked.ai}
                onChange={(v) => update("locked.ai", v)}
                label="Protetto"
              />
              {isGroupLocked('ai') && (
                <Button variant="subtle" size="sm" onClick={() => handleUnlock('ai')}>
                  Sblocca
                </Button>
              )}
            </div>
          </div>
          <CatalogEditor
            value={local.aiCatalog}
            onChange={(next) => update("aiCatalog", next)}
            disabled={isGroupLocked('ai')}
          />
        </Card>
        {/* ...other cards... */}
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
                  setCurveMinKW(isNaN(v) ? curveMinKW : String(v));
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
            &nbsp;·&nbsp;50 kW → {currency(pricePerKWFromCurve(50, {minKW:curveMinKW,priceAtMin:curvePriceAtMin,maxKW:curveMaxKW,priceAtMax:curvePriceAtMax}))}
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
              normLocal.wallboxPricing = normalizeWallboxPricing(normLocal.wallboxPricing);
              normLocal.ai = normalizeAi(normLocal.ai);
              normLocal.aiConfig = normalizeAiConfig(normLocal.aiConfig);
              normLocal.aiCatalog = normalizeAiCatalog(normLocal.aiCatalog);
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
  // --- ADD: wallbox summary ---
  const isWallbox = offer.type === "wallbox";
  const isAI = offer.type === "ai";

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

  // Calcolo stima economica Wallbox
  let stimaWB = null;
  if (isWallbox) {
    const s = offer.settingsSnapshot;
    const kw = Number(offer.computed.chargerKW);
    const dist = offer.computed.distanceBand;
    const typ = offer.computed.chargerType;
    const wb = s.wallboxPricing || DEFAULT_SETTINGS.wallboxPricing;
    const base = parseFloat(String(wb.base?.[typ]).replace(",", ".")) || 0;
    const addon = parseFloat(String(wb.powerAddon?.[String(kw)]).replace(",", ".")) || 0;
    const install = parseFloat(String(wb.distanceBand?.[dist]).replace(",", ".")) || 0;
    const subtotal = base + addon + install;
    const vatPct = parseFloat(String(s.pricing?.vatPercent).replace(",", ".")) || 0;
    const vat = subtotal * vatPct / 100;
    const total = subtotal + vat;
    stimaWB = { base, addon, install, subtotal, vatPct, vat, total, typ, kw, dist };
  }

  // Calcolo stima economica AI
  let stimaAI = null;
  if (isAI && offer.aiEstimate) {
    const est = offer.aiEstimate;
    stimaAI = {
      rows: est.rows,
      travel: est.travel,
      labor: est.labor,
      totals: est.totals
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
      if (!window.html2pdf) {
        alert("Modulo PDF non caricato. Controlla lo script html2pdf nel file index.html.");
        return;
      }
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
      const worker = window.html2pdf().set(opt).from(pdfElement);
      const blob = await worker.outputPdf('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      await savePdfToDB(offer.offerRef, blob);
      document.body.removeChild(pdfElement);
    } catch (error) {
      console.error('Errore durante esportazione PDF:', error);
      alert('Si è verificato un errore durante la generazione del PDF');
    }
  };

  // --- vendorCopy/clientCopy: Wallbox prezzi ---
  const wallboxTable = stimaWB && (
    <Card className="mt-6">
      <SectionHeader title="Stima economica Wallbox" />
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td>Hardware ({stimaWB.typ === "presa" ? "Presa semplice" : stimaWB.typ === "standard" ? "Wallbox standard" : "Wallbox smart"})</td>
            <td>{currency(stimaWB.base)}</td>
          </tr>
          <tr>
            <td>Differenza potenza ({stimaWB.kw} kW)</td>
            <td>{currency(stimaWB.addon)}</td>
          </tr>
          <tr>
            <td>Installazione (distanza: {stimaWB.dist.replace("-", "–")} m)</td>
            <td>{currency(stimaWB.install)}</td>
          </tr>
          <tr>
            <td className="font-medium">Subtotale</td>
            <td className="font-medium">{currency(stimaWB.subtotal)}</td>
          </tr>
          <tr>
            <td>IVA ({number(stimaWB.vatPct, 1)}%)</td>
            <td>{currency(stimaWB.vat)}</td>
          </tr>
          <tr>
            <td className="font-semibold">Totale (IVA incl.)</td>
            <td className="font-semibold">{currency(stimaWB.total)}</td>
          </tr>
        </tbody>
      </table>
    </Card>
  );

  // --- vendorCopy/clientCopy: AI prezzi ---
  const aiTableVendor = stimaAI && (
    <Card className="mt-6">
      <SectionHeader title="Stima economica AI" />
      <table className="w-full text-sm mb-2">
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Dettagli</th>
            <th>Q.tà</th>
            <th>Materiali</th>
            <th>Ore ele</th>
            <th>Ore appr</th>
            <th>Viaggio</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {stimaAI.rows.map((r, idx) => (
            <tr key={idx}>
              <td>{r.category}</td>
              <td>{r.details}</td>
              <td>{r.qty}</td>
              <td>
                {r.materials.map(m => (
                  <div key={m.key}>{m.qty}x {m.descr} ({currency(m.unitCHF)}) = {currency((parseFloat(String(m.unitCHF).replace(",", ".")) || 0) * (parseFloat(String(m.qty).replace(",", ".")) || 0))}</div>
                ))}
              </td>
              <td>{number((parseFloat(String(r.minutes.ele).replace(",", ".")) || 0)/60,2)}</td>
              <td>{number((parseFloat(String(r.minutes.app).replace(",", ".")) || 0)/60,2)}</td>
              <td>{r.travelMinutesAR}</td>
              <td>{r.note}</td>
            </tr>
          ))}

        </tbody>
      </table>
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td>Manodopera</td>
            <td>{currency(stimaAI.totals.laborCHF)}</td>
          </tr>
          <tr>
            <td>Materiali</td>
            <td>{currency(stimaAI.totals.materialsCHF)}</td>
          </tr>
          <tr>
            <td>Spostamento</td>
            <td>{currency(stimaAI.totals.travelCHF)}</td>
          </tr>
          <tr>
            <td>Subtotale</td>
            <td>{currency(stimaAI.totals.subtotal)}</td>
          </tr>
          <tr>
            <td>Sconto (%)</td>
            <td>{number(stimaAI.totals.discountPct,1)}%</td>
          </tr>
          <tr>
            <td>IVA ({number(stimaAI.totals.vatPct,1)}%)</td>
            <td>{currency(stimaAI.totals.vat)}</td>
          </tr>
          <tr>
            <td className="font-semibold">Totale (IVA incl.)</td>
            <td className="font-semibold">{currency(stimaAI.totals.total)}</td>
          </tr>
        </tbody>
      </table>
    </Card>
  );

  const aiTableClient = stimaAI && (
    <Card className="mt-6">
      <SectionHeader title="Sintesi economica" />
      <div className="mb-2">
        {offer.customer?.firstName ? `Gentile ${offer.customer.firstName},` : "Gentile cliente,"}
        <br />
        Le proponiamo l'intervento richiesto con le seguenti lavorazioni:
        <ul className="list-disc ml-4">
          {stimaAI.rows.map((r, idx) => (
            <li key={idx}>{r.category}{r.details ? `: ${r.details}` : ""} ({r.qty}x)</li>
          ))}
        </ul>
        Materiali previsti: {stimaAI.rows.flatMap(r => r.materials.map(m => `${m.qty}x ${m.descr}`)).join(", ") || "nessun materiale specificato"}.
        <br />
        Manodopera e spostamento inclusi. Totale stimato (IVA inclusa): <b>{currency(stimaAI.totals.total)}</b>.
      </div>
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td>Materiali</td>
            <td>{currency(stimaAI.totals.materialsCHF)}</td>
          </tr>
          <tr>
            <td>Manodopera</td>
            <td>{currency(stimaAI.totals.laborCHF)}</td>
          </tr>
          <tr>
            <td>Spostamento</td>
            <td>{currency(stimaAI.totals.travelCHF)}</td>
          </tr>
          <tr className="font-semibold">
            <td className="text-right">Totale (IVA incl.)</td>
            <td>{currency(stimaAI.totals.total)}</td>
          </tr>
        </tbody>
      </table>
    </Card>
  );

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
      {isWallbox && wallboxTable}
      {isAI && aiTableVendor}
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
            <table className="w-full text-left text-sm">
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
      {isWallbox && wallboxTable}
      {isAI && aiTableClient}
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
  // --- ADD: wallbox summary ---
  const isWallbox = offer.type === "wallbox";

  // Calcolo prezzo totale Wallbox (IVA inclusa) per la stampa
  let wallboxTotalCHF = null;
  if (isWallbox) {
    const wb = (s.wallboxPricing || DEFAULT_SETTINGS.wallboxPricing);
    const typ = offer.computed.chargerType;
    const kw  = String(offer.computed.chargerKW);
    const dist = offer.computed.distanceBand;

    const base    = parseFloat(String(wb.base?.[typ]).replace(",", ".")) || 0;
    const addon   = parseFloat(String(wb.powerAddon?.[kw]).replace(",", ".")) || 0;
    const install = parseFloat(String(wb.distanceBand?.[dist]).replace(",", ".")) || 0;

    const subtotal = base + addon + install;
    const vatPct   = parseFloat(String(s.pricing?.vatPercent).replace(",", ".")) || 0;
    wallboxTotalCHF = subtotal * (1 + (vatPct / 100));
  }

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
        {isWallbox && (
          <>
            <SectionHeader title="Proposta Wallbox" />
            <table className="w-full text-left text-sm mb-2">
              <tbody>
                <tr>
                  <td className="py-1 text-zinc-500">Potenza scelta</td>
                  <td className="py-1 font-medium">{offer.computed.chargerKW} kW</td>
                </tr>
                <tr>
                  <td className="py-1 text-zinc-500">Distanza dal quadro</td>
                  <td className="py-1 font-medium">{offer.computed.distanceBand.replace("-", "–")} m</td>
                </tr>
                <tr>
                  <td className="py-1 text-zinc-500">Tipo punto di ricarica</td>
                  <td className="py-1 font-medium">
                    {offer.computed.chargerType === "presa" ? "Presa semplice"
                      : offer.computed.chargerType === "standard" ? "Wallbox standard"
                      : offer.computed.chargerType === "smart" ? "Wallbox smart"
                      : offer.computed.chargerType}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-zinc-500">Prezzo</td>
                  <td className="py-1 font-medium">
                    {wallboxTotalCHF != null ? currency(wallboxTotalCHF) : "Da definire"}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}
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
                  <td className="py-1">{number(offer.computed.annualKWh, 0)} kWh/anno</td>
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
        ) : offer.type === "maintenance" ? (
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
        ) : null}
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
                    {offer.type === 'install' ? ' Nuovo impianto'
                      : offer.type === 'maintenance' ? ' Manutenzione'
                      : offer.type === 'service' ? <span><span className="inline-block px-2 py-1 bg-fuchsia-100 text-fuchsia-700 rounded text-xs font-semibold mr-1">Bozza AI</span>Preventivo rapido</span>
                      : ''}
                    · {offer.customer?.firstName || ""} {offer.customer?.lastName || ""}
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

// --- Segnaposto Wallbox ---
function WallboxForm({ form, setForm, settings, onCreate }) {
  // Etichette per select
  const chargerTypes = [
    { value: "presa", label: "Presa semplice" },
    { value: "standard", label: "Wallbox standard" },
    { value: "smart", label: "Wallbox smart" }
  ];
  const chargerKWs = [
    { value: "11", label: "11 kW" },
    { value: "22", label: "22 kW" }
  ];
  const distanceBands = [
    { value: "0-5", label: "0–5 m" },
    { value: "5-10", label: "5–10 m" },
    { value: "10-25", label: "10–25 m" },
    { value: "25-50", label: "25–50 m" }
  ];

  // Riassunto live
  const summaryRows = [
    { label: "Potenza wallbox", value: chargerKWs.find(x => x.value === form.chargerKW)?.label || `${form.chargerKW} kW` },
    { label: "Distanza dal quadro elettrico", value: distanceBands.find(x => x.value === form.distanceBand)?.label || form.distanceBand },
    { label: "Tipo punto di ricarica", value: chargerTypes.find(x => x.value === form.chargerType)?.label || form.chargerType }
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Offerta Wallbox</h2>
        <Button variant="ghost" onClick={() => window.history.back?.() || setForm(form)}>Annulla</Button>
      </div>
      <Card>
        <div className="grid gap-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Dati cliente</h3>
            <PersonFields form={form} setForm={setForm} settings={settings} />
            <div className="grid gap-3 md:grid-cols-2 mt-3">
              <Labeled label="Telefono">
                <Input
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="Telefono"
                />
              </Labeled>
              <Labeled label="Email">
                <Input
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="Email"
                />
              </Labeled>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Labeled label="Potenza Wallbox">
              <select
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition dark:border-zinc-700 dark:bg-zinc-950"
                value={form.chargerKW}
                onChange={e => setForm({ ...form, chargerKW: e.target.value })}
              >
                {chargerKWs.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Labeled>
            <Labeled label="Distanza dal quadro elettrico">
              <select
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition dark:border-zinc-700 dark:bg-zinc-950"
                value={form.distanceBand}
                onChange={e => setForm({ ...form, distanceBand: e.target.value })}
              >
                {distanceBands.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Labeled>
            <Labeled label="Tipo punto di ricarica">
              <select
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition dark:border-zinc-700 dark:bg-zinc-950"
                value={form.chargerType}
                onChange={e => setForm({ ...form, chargerType: e.target.value })}
              >
                {chargerTypes.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Labeled>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm dark:border-purple-900/50 dark:bg-purple-900/20">
            <b>Riepilogo selezione:</b>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {summaryRows.map(row => (
                  <tr key={row.label}>
                    <td className="text-zinc-500">{row.label}</td>
                    <td className="font-medium">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={FileText} onClick={onCreate}>
              Genera offerta
            </Button>
            <Button variant="ghost" onClick={() => window.history.back?.() || setForm(form)}>Annulla</Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// --- TriageAssistant (AI Preventivo rapido) ---
function TriageAssistant({ setRoute, openOffer }) {
  const [customer, setCustomer] = useState({
    firstName: "",
    lastName: "",
    street: "",
    cap: "",
    city: "",
    country: "Svizzera",
    phone: "",
    email: ""
  });
  const [lines, setLines] = useState([]);
  const [current, setCurrent] = useState({
    category: "",
    details: "",
    qty: 1,
    timeMin: 0,
    materialCHF: 0,
    travelMinAR: 0
  });
  const [showMaterials, setShowMaterials] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [bozzaMode, setBozzaMode] = useState(false);
  const [notes, setNotes] = useState("");
  const [snackbar, setSnackbar] = useState("");
  const [calloutApplied, setCalloutApplied] = useState(true);
  const settings = loadSettings();
  const aiConfig = settings.aiConfig || DEFAULT_SETTINGS.aiConfig;
  const vatPct = settings.pricing.vatPercent || 8.1;

  // Se openOffer è passato, carica la bozza
  useEffect(() => {
    if (openOffer && openOffer.type === "service" && openOffer.aiDraft) {
      setCustomer(openOffer.customer || {});
      setLines(openOffer.aiDraft.lines || []);
      setNotes(openOffer.aiDraft.notes || "");
      setBozzaMode(true);
      setCalloutApplied(typeof openOffer.aiDraft.calloutApplied === "boolean" ? openOffer.aiDraft.calloutApplied : (aiConfig.autoApplyCallout ?? true));
    }
  }, [openOffer]);

  // Autocompilazione CAP → Città
  useEffect(() => {
    const cap = customer.cap?.trim();
    if (cap && settings.capToCity[cap]) {
      setCustomer((f) => ({ ...f, city: settings.capToCity[cap] }));
    }
  }, [customer.cap, settings.capToCity]);

  // Stima viaggio
  function stimaViaggio() {
    const city = customer.city?.trim().toLowerCase();
    const localMin = parseFloat(String(aiConfig.defaults.travelMinutesOneWayLocal).replace(",", ".")) || 15;
    const extraMin = parseFloat(String(aiConfig.defaults.travelMinutesOneWayExtra).replace(",", ".")) || 35;
    const isLocal = city === "bellinzona";
    setCurrent(c => ({ ...c, travelMinAR: (isLocal ? localMin : extraMin) * 2 }));
  }

  // Handler aggiunta/modifica riga
  function addOrEditLine() {
    const qty = parseInt(current.qty) || 1;
    const timeMin = parseFloat(String(current.timeMin).replace(",", ".")) || 0;
    const materialCHF = parseFloat(String(current.materialCHF).replace(",", ".")) || 0;
    const travelMinAR = parseFloat(String(current.travelMinAR).replace(",", ".")) || 0;
    const line = {
      id: Math.random().toString(36).slice(2),
      descrizione: `${current.category}${current.details ? `: ${current.details}` : ""}`,
      qty,
      tempoMinTot: timeMin,
      materialiTotCHF: materialCHF * qty,
      viaggioMinAR: travelMinAR,
      editable: true
    };
    if (editingIdx !== null) {
      const arr = [...lines];
      arr[editingIdx] = line;
      setLines(arr);
      setEditingIdx(null);
    } else {
      setLines([...lines, line]);
    }
    setCurrent({ category: "", details: "", qty: 1, timeMin: 0, materialCHF: 0, travelMinAR: 0 });
  }

  // Handler modifica riga
  function editLine(idx) {
    const l = lines[idx];
    setEditingIdx(idx);
    setCurrent({
      category: l.descrizione.split(":")[0] || "",
      details: l.descrizione.split(":")[1]?.trim() || "",
      qty: l.qty,
      timeMin: l.tempoMinTot,
      materialCHF: l.materialiTotCHF / (l.qty || 1),
      travelMinAR: l.viaggioMinAR || 0
    });
  }

  // Handler rimuovi riga
  function removeLine(idx) {
    setLines(lines.filter((_, i) => i !== idx));
    setEditingIdx(null);
    setCurrent({ category: "", details: "", qty: 1, timeMin: 0, materialCHF: 0, travelMinAR: 0 });
  }

  // Calcolo preventivo
  const totalTimeMin = lines.reduce((sum, l) => sum + (parseFloat(String(l.tempoMinTot).replace(",", ".")) || 0), 0);
  const totalMaterialCHF = lines.reduce((sum, l) => sum + (parseFloat(String(l.materialiTotCHF).replace(",", ".")) || 0), 0);
  const travelMinAR = lines.length > 0 ? (parseFloat(String(lines[0].viaggioMinAR).replace(",", ".")) || 0) : 0;
  const rates = aiConfig.rates || {};
  const hourlyWorker = parseFloat(String(rates.hourlyWorker).replace(",", ".")) || 95;
  const hourlyApprentice = parseFloat(String(rates.hourlyApprentice).replace(",", ".")) || 55;
  const calloutFee = calloutApplied ? (parseFloat(String(rates.calloutFee).replace(",", ".")) || 135) : 0;
  const travelRatePerMinute = parseFloat(String(rates.travelRatePerMinute).replace(",", ".")) || 0;
  const teamHourly = hourlyWorker + hourlyApprentice;
  const timeH = totalTimeMin / 60;
  const travelH = travelMinAR / 60;
  const laborCHF = (timeH + travelH) * teamHourly;
  const travelCHF = travelRatePerMinute > 0 ? travelMinAR * travelRatePerMinute : 0;
  const subtotal = laborCHF + totalMaterialCHF + calloutFee + travelCHF;
  const iva = subtotal * vatPct / 100;
  const total = subtotal + iva;

  // Testo discorsivo preventivo cliente
  const preventivoCliente = `Buongiorno, sono di Edil Repairs Sagl (${aiConfig.companyHQ}).\n
Le propongo il seguente preventivo per le lavorazioni richieste:\n` +
    lines.map(l => `- ${l.descrizione} (${l.qty}x)`).join("\n") +
    `\nMateriali e manodopera inclusi. Spostamento e call-out inclusi. Totale stimato (IVA inclusa): ${currency(total)}.\n`;

  // PDF export (hardening: DOM nodes, no innerHTML)
  async function exportBozzaPdf() {
    if (!window.html2pdf) {
      alert("Modulo PDF non caricato. Controlla lo script html2pdf nel file index.html.");
      return;
    }
    const pdfDiv = document.createElement("div");
    pdfDiv.style.fontFamily = "sans-serif";
    pdfDiv.style.maxWidth = "600px";
    pdfDiv.style.margin = "0 auto";
    pdfDiv.style.background = "white";
    pdfDiv.style.color = "black";
    pdfDiv.style.padding = "24px";
    pdfDiv.style.borderRadius = "12px";
    pdfDiv.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";

    // Header
    const header = document.createElement("div");
    header.style.textAlign = "center";
    const logo = document.createElement("img");
    logo.src = import.meta.env.BASE_URL + "img/logoedil.png";
    logo.alt = "Edil Repairs";
    logo.style.height = "48px";
    logo.style.objectFit = "contain";
    logo.style.marginBottom = "8px";
    const h2 = document.createElement("h2");
    h2.textContent = "Bozza Preventivo - Edil Repairs Sagl";
    header.appendChild(logo);
    header.appendChild(h2);
    pdfDiv.appendChild(header);

    // Cliente
    const cliente = document.createElement("div");
    cliente.textContent =
      `Cliente: ${(customer.firstName||"")} ${(customer.lastName||"")}, ` +
      `${(customer.street||"")}, ${(customer.cap||"")} ${(customer.city||"")}`;
    pdfDiv.appendChild(cliente);

    const sede = document.createElement("div");
    sede.textContent = `Sede: ${settings.aiConfig?.companyHQ || ""}`;
    pdfDiv.appendChild(sede);

    const hr = document.createElement("hr");
    pdfDiv.appendChild(hr);

    // Lavorazioni
    const h3a = document.createElement("h3");
    h3a.textContent = "Lavorazioni";
    pdfDiv.appendChild(h3a);

    const ul = document.createElement("ul");
    lines.forEach(l => {
      const li = document.createElement("li");
      li.textContent = `${l.descrizione} (${l.qty}x)`;
      ul.appendChild(li);
    });
    pdfDiv.appendChild(ul);

    // Riepilogo economico
    const h3b = document.createElement("h3");
    h3b.textContent = "Riepilogo economico";
    pdfDiv.appendChild(h3b);

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    const rows = [
      ["Materiali", currency(totalMaterialCHF)],
      [`Manodopera (${number(timeH+travelH,2)} h squadra)`, currency(laborCHF)],
      [`Viaggio (${number(travelMinAR,0)} min)`, currency(travelCHF)],
      ["Call-out", currency(calloutFee)],
      [`IVA (${number(vatPct,1)}%)`, currency(iva)],
      ["Totale", currency(total)]
    ];
    rows.forEach(([k,v]) => {
      const tr = document.createElement("tr");
      const td1 = document.createElement("td"); td1.textContent = k;
      const td2 = document.createElement("td"); td2.textContent = v;
      tr.appendChild(td1); tr.appendChild(td2);
      table.appendChild(tr);
    });
    pdfDiv.appendChild(table);

    if (notes) {
      const notesDiv = document.createElement("div");
      notesDiv.style.marginTop = "12px";
      const b = document.createElement("b"); b.textContent = "Note interne: ";
      const span = document.createElement("span"); span.textContent = notes;
      notesDiv.appendChild(b); notesDiv.appendChild(span);
      pdfDiv.appendChild(notesDiv);
    }

    document.body.appendChild(pdfDiv);

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `bozza-${nextOfferRef()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    await window.html2pdf().set(opt).from(pdfDiv).save();
    document.body.removeChild(pdfDiv);
  }

  // Salva bozza in IndexedDB
  async function saveBozza() {
    const offerRef = nextOfferRef();
    const offer = {
      type: "service",
      offerRef,
      createdAt: new Date().toISOString(),
      customer,
      settingsSnapshot: settings,
      aiDraft: {
        lines,
        totals: {
          totalTimeMin,
          totalMaterialCHF,
          travelMinAR,
          laborCHF,
          travelCHF,
          calloutFee,
          subtotal,
          iva,
          total
        },
        notes,
        calloutApplied
      }
    };
    await saveOfferToDB(offer);
    setSnackbar("Bozza salvata in Archivio");
    setTimeout(() => setSnackbar(""), 2000);
  }

  // UI
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Assistente AI (preventivo rapido)</h2>
        <Button variant="ghost" onClick={() => setRoute("home")}>Indietro</Button>
      </div>
      <Card>
        <div className="grid gap-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Dati cliente</h3>
            <PersonFields form={customer} setForm={setCustomer} settings={settings} />
            <div className="grid gap-3 md:grid-cols-2 mt-3">
              <Labeled label="Telefono">
                <Input
                  value={customer.phone}
                  onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                  placeholder="Telefono"
                />
              </Labeled>
              <Labeled label="Email">
                <Input
                  value={customer.email}
                  onChange={e => setCustomer({ ...customer, email: e.target.value })}
                  placeholder="Email"
                />
              </Labeled>
            </div>
          </div>
          {!bozzaMode && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Nuova richiesta</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <Labeled label="Categoria">
                  <select
                    value={current.category}
                    onChange={e => setCurrent(c => ({ ...c, category: e.target.value }))
                    }
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <option value="">Seleziona...</option>
                    {Object.keys(aiConfig.taskTimesMin).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </Labeled>
                <Labeled label="Dettagli">
                  <Input
                    value={current.details}
                    onChange={e => setCurrent(c => ({ ...c, details: e.target.value }))}
                    placeholder="Dettagli lavorazione"
                  />
                </Labeled>
                <Labeled label="Quantità">
                  <Input
                    inputMode="numeric"
                    value={current.qty}
                    onChange={e => setCurrent(c => ({ ...c, qty: e.target.value.replace(/[^0-9]/g, "") }))}
                  />
                </Labeled>
                <Labeled label="Tempo (min)">
                  <Input
                    inputMode="numeric"
                    value={current.timeMin}
                    onChange={e => setCurrent(c => ({ ...c, timeMin: e.target.value.replace(/[^0-9]/g, "") }))}
                    placeholder={`Default: ${aiConfig.taskTimesMin[current.category] || ""}`}
                  />
                </Labeled>
                <Labeled label="Materiale (CHF/unità)">
                  <Input
                    inputMode="decimal"
                    value={current.materialCHF}
                    onChange={e => setCurrent(c => ({ ...c, materialCHF: e.target.value.replace(/[^0-9.,]/g, "") }))}
                    placeholder={`Default: ${aiConfig.materialsCHF[Object.keys(aiConfig.materialsCHF).find(k => k.toLowerCase().includes(current.category?.toLowerCase() || ""))] || ""}`}
                  />
                </Labeled>
                <Labeled label="Viaggio A/R (min)">
                  <Input
                    inputMode="numeric"
                    value={current.travelMinAR}
                    onChange={e => setCurrent(c => ({ ...c, travelMinAR: e.target.value.replace(/[^0-9]/g, "") }))}
                  />
                  <Button variant="subtle" onClick={stimaViaggio}>Stima viaggio</Button>
                </Labeled>
              </div>
              <div className="mt-3 flex gap-2">
                <Button onClick={addOrEditLine}>{editingIdx !== null ? "Salva modifica" : "Aggiungi richiesta"}</Button>
                <Button variant="ghost" onClick={() => setBozzaMode(true)}>Concludi e genera bozza</Button>
              </div>
            </div>
          )}
          <div className="mt-4">
            <SectionHeader title="Righe bozza" />
            <table className="w-full text-sm mb-2">
              <thead>
                <tr>
                  <th>Descrizione</th>
                  <th>Q.tà</th>
                  <th>Tempo (min)</th>
                  <th>Materiali (CHF)</th>
                  <th>Viaggio (min)</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={l.id}>
                    <td>{l.descrizione}</td>
                    <td>{l.qty}</td>
                    <td>{l.tempoMinTot}</td>
                    <td>{l.materialiTotCHF}</td>
                    <td>{l.viaggioMinAR}</td>
                    <td>
                      <Button variant="subtle" size="sm" onClick={() => editLine(idx)}>Modifica</Button>
                      <Button variant="subtle" size="sm" onClick={() => removeLine(idx)}>Rimuovi</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Checkbox
              checked={showMaterials}
              onChange={setShowMaterials}
              label="Mostra dettaglio materiali per riga"
            />
            {showMaterials && (
              <div className="mt-2 text-xs text-zinc-500">
                {lines.map((l, idx) => (
                  <div key={l.id}>
                    Riga {idx + 1}: {l.descrizione} - Materiali stimati: {currency(l.materialiTotCHF)}
                  </div>
                ))}
              </div>
            )}
          </div>
          {bozzaMode && (
            <div>
              <SectionHeader title="Bozza preventivo" />
              <div className="mb-2">
                <textarea className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm" rows={4} value={preventivoCliente} readOnly />
                <Button variant="subtle" onClick={() => navigator.clipboard.writeText(preventivoCliente)}>Copia testo</Button>
              </div>
              <div className="mb-2">
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td>Materiali</td>
                      <td>{currency(totalMaterialCHF)}</td>
                    </tr>
                    <tr>
                      <td>Manodopera ({number(timeH+travelH,2)} h squadra)</td>
                      <td>{currency(laborCHF)}</td>
                    </tr>
                    <tr>
                      <td>Viaggio ({number(travelMinAR,0)} min)</td>
                      <td>{currency(travelCHF)}</td>
                    </tr>
                    <tr>
                      <td>
                        Call-out
                        <Checkbox
                          checked={calloutApplied}
                          onChange={v => setCalloutApplied(v)}
                          label={calloutApplied ? "Applica" : "Non applicare"}
                        />
                      </td>
                      <td>{currency(calloutFee)}</td>
                    </tr>
                    <tr>
                      <td>IVA ({number(vatPct,1)}%)</td>
                      <td>{currency(iva)}</td>
                    </tr>
                    <tr className="font-semibold">
                      <td className="text-right">Totale</td>
                      <td>{currency(total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <Labeled label="Note interne">
                <textarea
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Note interne (non visibili al cliente)"
                />
              </Labeled>
              <div className="flex gap-2 mt-2">
                <Button icon={FileText} onClick={exportBozzaPdf}>Esporta PDF</Button>
                <Button variant="primary" onClick={saveBozza}>Salva bozza in Archivio</Button>
                <Button variant="ghost" onClick={() => setBozzaMode(false)}>Modifica richieste</Button>
                <Button variant="ghost" onClick={() => { setLines([]); setBozzaMode(false); setNotes(""); }}>Reset sessione</Button>
              </div>
              {snackbar && <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-xl shadow">{snackbar}</div>}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function Footer({ company }) {
  const year = new Date().getFullYear();
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-zinc-200 bg-white/80 px-4 py-2 text-center text-xs text-zinc-500 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/75">
      © {year} {company?.name || "La Mia Azienda"} · Pronto per stampa/PDF · Dati salvati in locale
    </div>
  );
}
