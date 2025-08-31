import React, { useMemo, useState } from "react";
import { WIZARD_TREE } from "./wizardTree.js";
import { saveOfferToDB } from "../lib/db.js";

function uid() {
  return (crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
}
function nextRef() {
  const d = new Date();
  const ymd = [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("");
  return `SRV-${ymd}-${uid().slice(0,6).toUpperCase()}`;
}

export default function AIWizard({ settings, ...restProps }) {
  if (!settings) {
    return (
      <div className="p-6 text-center text-red-600">
        Errore: impostazioni non disponibili. Controlla la configurazione in Admin.
      </div>
    );
  }

  const aiCatalog = useMemo(() => (settings?.aiCatalog ?? {}), [settings]);
  const aiConfig = settings.aiConfig || {};
  const vatPct = Number(settings.pricing?.vatPercent || 0);

  const [activeCat, setActiveCat] = useState(null);
  const [answers, setAnswers] = useState({});
  const [items, setItems] = useState([]);
  const [travelMinutes, setTravelMinutes] = useState(
    Number(aiConfig?.defaults?.travelMinutesOneWayLocal || 0) * 2
  );
  const [applyCallout, setApplyCallout] = useState(
    !!aiConfig?.autoApplyCallout
  );

  // Add customer state for offer
  const [customer, setCustomer] = useState({});

  const num = (v, d = 0) => {
    const n = parseFloat(String(v).replace(",", "."));
    return isNaN(n) ? d : n;
  };

  const currency = (v) =>
    new Intl.NumberFormat("it-CH", { style: "currency", currency: "CHF" }).format(v);

  const categories = useMemo(() => WIZARD_TREE?.categories ?? [], []);
  const category = useMemo(
    () => categories.find(c => c.key === activeCat) || null,
    [categories, activeCat]
  );

  const allStepsAnswered = useMemo(() => {
    if (!category) return false;
    const steps = category.steps || [];
    for (const s of steps) {
      const v = answers?.[s.key];
      if (s.type === "number") {
        if (v === undefined || v === null || String(v).trim() === "") return false;
      } else if (s.type === "text") {
        if (!String(v || "").trim()) return false;
      } else {
        // scelta singola
        if (!v) return false;
      }
    }
    return true;
  }, [category, answers]);

  // --- Helper for readable label ---
  function labelOf(choices = [], key) {
    const f = choices.find(c => c.key === key);
    return f ? f.label : key;
  }

  // --- Preview calculation ---
  function computePreviewFromAnswers(answers, category, aiCatalog) {
    if (!category) return null;

    const vatPct = Number(settings?.pricing?.vatPercent ?? 0);
    const hourly = Number(settings?.aiConfig?.rates?.hourlyWorker ?? 0);
    const travelPerMin = Number(settings?.aiConfig?.rates?.travelRatePerMinute ?? 0);
    const calloutFee = Number(settings?.aiConfig?.rates?.calloutFee ?? 0);
    // Se l’utente ha spuntato/levato la checkbox, rispettiamo quel valore; altrimenti usiamo il default admin
    const applyCallout = (answers?.applyCallout ?? false) || (!!settings?.aiConfig?.autoApplyCallout && answers?.applyCallout == null);

    const qta = Math.max(1, num(answers?.quantita, 1));

    let minutesPU = 0;
    let materialsPU = 0;
    let descr = category.label;

    switch (category.key) {
      case "luce": {
        const tipo = answers?.tipoLuce;
        const stile = answers?.stile;
        const ctx = answers?.ambiente;
        const node = aiCatalog?.luce?.[tipo] || {};
        const ctxAdd = node?.contextAddons?.[ctx] || {};
        const matTier = node?.materials?.[stile];

        minutesPU = Number(node?.minutesTeamPerUnit ?? 0) + Number(ctxAdd?.extraMinutes ?? 0);
        materialsPU = Number(matTier?.unitCHF ?? 0) + Number(ctxAdd?.extraCHF ?? 0);

        descr = [
          "Luce",
          labelOf(category.steps?.[0]?.choices, tipo),
          labelOf(category.steps?.[1]?.choices, ctx),
          labelOf(category.steps?.[2]?.choices, stile)
        ].filter(Boolean).join(" · ");
        break;
      }
      case "prese_interruttori": {
        const t = answers?.tipoPunto;
        const node = aiCatalog?.prese_interruttori?.[t] || {};
        minutesPU = Number(node?.minutesTeamPerUnit ?? 0);
        materialsPU = Number(node?.materials?.base?.unitCHF ?? 0);
        descr = ["Punto", labelOf(category.steps?.[0]?.choices, t)].filter(Boolean).join(" · ");
        break;
      }
      case "wallbox": {
        const pwr = answers?.potenza;
        const kind = answers?.tipoWB;
        const dist = answers?.distanza;
        const node = aiCatalog?.wallbox?.[pwr] || {};
        minutesPU = Number(node?.minutesTeamPerUnit ?? 0);
        const mat = Number(node?.materials?.[kind]?.unitCHF ?? 0);
        const distCHF = Number(node?.distanceBandCHF?.[dist] ?? 0);
        materialsPU = mat + distCHF;
        descr = ["Wallbox", `${pwr} kW`, labelOf(category.steps?.[1]?.choices, kind), `${dist} m`]
          .filter(Boolean).join(" · ");
        break;
      }
      case "telefonia": {
        const t = answers?.tipo;
        const node = aiCatalog?.telefonia?.[t] || {};
        minutesPU = Number(node?.minutesTeamPerUnit ?? 0);
        materialsPU = Number(node?.materials?.base?.unitCHF ?? 0);
        descr = ["Telefonia", labelOf(category.steps?.[0]?.choices, t)].filter(Boolean).join(" · ");
        break;
      }
      case "videosorveglianza": {
        const t = answers?.tipo;
        const node = aiCatalog?.videosorveglianza?.[t] || {};
        minutesPU = Number(node?.minutesTeamPerUnit ?? 0);
        materialsPU = Number(node?.materials?.base?.unitCHF ?? 0);
        descr = ["Videosorveglianza", labelOf(category.steps?.[0]?.choices, t)].filter(Boolean).join(" · ");
        break;
      }
      case "domotica": {
        const t = answers?.tipo;
        const node = aiCatalog?.domotica?.[t] || {};
        minutesPU = Number(node?.minutesTeamPerUnit ?? 0);
        materialsPU = Number(node?.materials?.base?.unitCHF ?? 0);
        descr = ["Domotica", labelOf(category.steps?.[0]?.choices, t)].filter(Boolean).join(" · ");
        break;
      }
      case "riparazioni": {
        const t = answers?.tipo;
        const node = aiCatalog?.riparazioni?.[t] || {};
        minutesPU = Number(node?.minutesTeamPerUnit ?? 0);
        materialsPU = Number(node?.materials?.base?.unitCHF ?? 0);
        descr = ["Riparazioni", labelOf(category.steps?.[0]?.choices, t)].filter(Boolean).join(" · ");
        break;
      }
      case "altro": {
        minutesPU = Number(aiCatalog?.altro?.custom?.minutesTeamPerUnit ?? 0);
        materialsPU = Number(aiCatalog?.altro?.custom?.materials?.base?.unitCHF ?? 0);
        const descUser = answers?.descrizione?.trim();
        descr = descUser ? `Altro · ${descUser}` : "Altro (personalizzato)";
        break;
      }
      default:
        return null;
    }

    const laborPU = (minutesPU / 60) * hourly;
    const netPU = laborPU + materialsPU;
    // Minutes A/R: se l’utente specifica i minuti totali A/R li usiamo; altrimenti default: (one-way default) * 2
    const defaultOneWay = Number(settings?.aiConfig?.defaults?.travelMinutesOneWayLocal ?? 0);
    const travelMinutesTotal = Number(answers?.travelMinutes ?? (defaultOneWay * 2));
    const travelCHFLoc = travelPerMin * Math.max(0, travelMinutesTotal);
    const calloutCHFLoc = applyCallout ? calloutFee : 0;

    const subTotLoc = netPU * qta + travelCHFLoc + calloutCHFLoc;
    const vatLoc = subTotLoc * (vatPct / 100);
    const totLoc = subTotLoc + vatLoc;

    if (qta > 1) descr = `${descr} × ${qta}`;

    return {
      description: descr,
      qta,
      minutesPU,
      materialsPU,
      laborPU,
      netPU,
      travelCHF: travelCHFLoc,
      calloutCHF: calloutCHFLoc,
      vatPct,
      subtotal: subTotLoc,
      total: totLoc
    };
  }

  function addCurrentToList() {
    const prev = computePreviewFromAnswers(answers, category, aiCatalog);
    if (!prev) return;
    const newItem = {
      description: prev.description,
      qty: prev.qta,
      netPerUnit: prev.netPU,
      materialsPerUnit: prev.materialsPU,
      laborPerUnit: prev.laborPU,
      subtotal: prev.subtotal,
      total: prev.total,
      vatPct: prev.vatPct,
      meta: {
        category: category?.key,
        answers,
        travelMinutesAR: answers?.travelMinutes ?? (Number(settings?.aiConfig?.defaults?.travelMinutesOneWayLocal ?? 0) * 2),
        calloutApplied: (answers?.applyCallout ?? false) || (!!settings?.aiConfig?.autoApplyCallout && answers?.applyCallout == null)
      }
    };
    setItems((arr) => [...(arr || []), newItem]);
  }

  // --- Preview calculation ---
  const preview = useMemo(() => {
    if (!activeCat) return null;
    let desc = "";
    let minutesPerUnit = 0;
    let materialsUnit = 0;

    const qty = Math.max(1, num(answers.quantita, 1));
    const hourly = num(aiConfig?.rates?.hourlyWorker, 0);
    const travelPerMin = num(aiConfig?.rates?.travelRatePerMinute, 0);
    const calloutFee = num(aiConfig?.rates?.calloutFee, 0);

    if (activeCat === "luce") {
      const k = answers.tipoLuce;
      const stile = answers.stile;
      const ctx = answers.ambiente;
      const cfg = aiCatalog?.luce?.[k];
      if (!cfg) return null;
      minutesPerUnit = num(cfg.minutesTeamPerUnit);
      const tierCHF = num(cfg.materials?.[stile]?.unitCHF);
      const extraMin = num(cfg.contextAddons?.[ctx]?.extraMinutes);
      const extraCHF = num(cfg.contextAddons?.[ctx]?.extraCHF);
      minutesPerUnit += extraMin;
      materialsUnit = tierCHF + extraCHF;
      desc = `Luce · ${cfg.label || k} (${ctx}, ${cfg.materials?.[stile]?.label || stile})`;
    } else if (activeCat === "prese_interruttori") {
      const k = answers.tipoPunto;
      const cfg = aiCatalog?.prese_interruttori?.[k];
      if (!cfg) return null;
      minutesPerUnit = num(cfg.minutesTeamPerUnit);
      materialsUnit = num(cfg.materials?.base?.unitCHF);
      desc = `Prese/Interruttori · ${cfg.label || k}`;
    } else if (activeCat === "wallbox") {
      const pwr = answers.potenza;
      const type = answers.tipoWB;
      const dist = answers.distanza;
      const cfg = aiCatalog?.wallbox?.[pwr];
      if (!cfg) return null;
      minutesPerUnit = num(cfg.minutesTeamPerUnit);
      const baseMat = num(cfg.materials?.[type]?.unitCHF);
      const distCHF = num(cfg.distanceBandCHF?.[dist]);
      materialsUnit = baseMat + distCHF;
      desc = `Wallbox ${pwr} kW · ${cfg.materials?.[type]?.label || type} (distanza ${dist} m)`;
    } else if (activeCat === "telefonia") {
      const k = answers.tipo;
      const cfg = aiCatalog?.telefonia?.[k];
      if (!cfg) return null;
      minutesPerUnit = num(cfg.minutesTeamPerUnit);
      materialsUnit = num(cfg.materials?.base?.unitCHF);
      desc = `Telefonia/Internet · ${cfg.label || k}`;
    } else if (activeCat === "videosorveglianza") {
      const k = answers.tipo;
      const cfg = aiCatalog?.videosorveglianza?.[k];
      if (!cfg) return null;
      minutesPerUnit = num(cfg.minutesTeamPerUnit);
      materialsUnit = num(cfg.materials?.base?.unitCHF);
      desc = `Videosorveglianza · ${cfg.label || k}`;
    } else if (activeCat === "domotica") {
      const k = answers.tipo;
      const cfg = aiCatalog?.domotica?.[k];
      if (!cfg) return null;
      minutesPerUnit = num(cfg.minutesTeamPerUnit);
      materialsUnit = num(cfg.materials?.base?.unitCHF);
      desc = `Domotica · ${cfg.label || k}`;
    } else if (activeCat === "riparazioni") {
      const k = answers.tipo;
      const cfg = aiCatalog?.riparazioni?.[k];
      if (!cfg) return null;
      minutesPerUnit = num(cfg.minutesTeamPerUnit);
      materialsUnit = num(cfg.materials?.base?.unitCHF);
      desc = `Riparazioni · ${cfg.label || k}`;
    } else if (activeCat === "altro") {
      const descr = (answers.descrizione || "").trim();
      const cfg = aiCatalog?.altro?.custom;
      minutesPerUnit = num(cfg?.minutesTeamPerUnit);
      materialsUnit = num(cfg?.materials?.base?.unitCHF);
      desc = `Altro · ${descr || (cfg?.label || "Intervento")}`;
    } else {
      return null;
    }

    const laborPerUnitCHF = (minutesPerUnit / 60) * hourly;
    const netPerUnit = laborPerUnitCHF + materialsUnit;

    const travelCHF = travelPerMin * Math.max(0, num(travelMinutes, 0));
    const calloutCHF = applyCallout ? calloutFee : 0;

    const subtotal = netPerUnit * qty + travelCHF + calloutCHF;
    const vat = subtotal * (vatPct / 100);
    const total = subtotal + vat;

    return {
      description: desc,
      qty,
      minutesPerUnit,
      materialsUnit,
      laborPerUnitCHF,
      netPerUnit,
      travelCHF,
      calloutCHF,
      vatPct,
      subtotal,
      total,
    };
  }, [activeCat, answers, travelMinutes, applyCallout, aiCatalog, aiConfig, vatPct]);

  // --- Add item to cart ---
  function handleAddItem() {
    if (!preview) return;
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID?.() || String(Date.now()),
        category: activeCat,
        description: preview.description,
        qty: preview.qty,
        minutesPerUnit: preview.minutesPerUnit,
        materialsUnit: preview.materialsUnit,
        laborPerUnitCHF: preview.laborPerUnitCHF,
        netPerUnit: preview.netPerUnit,
      },
    ]);
    setAnswers((a) => ({ ...a, quantita: "" }));
  }

  function handleRemoveItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleClearCart() {
    setItems([]);
  }

  // --- Totals ---
  const itemsSubtotal = items.reduce(
    (sum, i) => sum + i.netPerUnit * i.qty,
    0
  );
  const hourly = num(aiConfig?.rates?.hourlyWorker, 0);
  const travelPerMin = num(aiConfig?.rates?.travelRatePerMinute, 0);
  const calloutFee = num(aiConfig?.rates?.calloutFee, 0);
  const travelCHF = travelPerMin * Math.max(0, num(travelMinutes, 0));
  const calloutCHF = applyCallout ? calloutFee : 0;
  const subtotal = itemsSubtotal + travelCHF + calloutCHF;
  const vat = subtotal * (vatPct / 100);
  const total = subtotal + vat;

  // For OfferView compatibility
  const totals = {
    itemsSubtotal,
    travel: travelCHF,
    callout: calloutCHF,
    net: subtotal,
    vat,
    gross: total,
  };

  async function generateOffer() {
    try {
      if (!items || !items.length) {
        alert("Aggiungi almeno un articolo prima di generare l'offerta.");
        return;
      }
      const vatPct = Number(settings?.pricing?.vatPercent ?? 0);
      const now = Date.now();
      const id = uid();
      const ref = nextRef();

      const lines = items.map(it => ({
        description: it.description,
        qty: Number(it.qty || 1),
        minutesPerUnit: Number(it.minutesPerUnit || 0),
        materialsUnitCHF: Number(it.materialsUnit || 0),
        laborPerUnitCHF: Number(it.laborPerUnitCHF || 0),
        unitNetCHF: Number(it.netPerUnit || (Number(it.materialsUnit||0) + Number(it.laborPerUnitCHF||0))),
        subtotalCHF: Number(it.subtotal || (Number(it.netPerUnit||0) * Number(it.qty||1))),
        vatCHF: 0,
        totalCHF: Number(it.total || 0)
      }));

      const offer = {
        id,
        ref,
        type: "service",
        createdAt: now,
        status: "draft",
        customer: {
          firstName: customer?.firstName || "",
          lastName:  customer?.lastName  || "",
          email:     customer?.email     || "",
          phone:     customer?.phone     || "",
          address:   customer?.address   || "",
          zip:       customer?.zip       || "",
          city:      customer?.city      || "",
        },
        items: lines,
        totals: {
          itemsSubtotalCHF: Number(totals?.itemsSubtotal || 0),
          travelCHF:        Number(totals?.travel || 0),
          calloutCHF:       Number(totals?.callout || 0),
          subtotalCHF:      Number(totals?.net || totals?.subtotal || 0),
          vatPercent:       vatPct,
          vatCHF:           Number(totals?.vat || 0),
          totalCHF:         Number(totals?.gross || 0),
        },
        computed: {
          fromAIWizard: true
        },
        settingsSnapshot: {
          company: settings?.company || {},
          pricing: settings?.pricing || {},
          aiConfig: settings?.aiConfig || {}
        }
      };

      await saveOfferToDB(offer);
      if (typeof openOffer === "function") openOffer(id);
      if (typeof setRoute === "function") setRoute("offer");
    } catch (err) {
      console.error("Errore creazione offerta:", err);
      alert("Non sono riuscito a creare l'offerta.");
    }
  }

  // --- UI ---
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h2 className="text-xl font-semibold mb-2">Assistente AI — Preventivo rapido</h2>
        {!activeCat ? (
          <div>
            <div className="mb-2 text-sm font-semibold text-zinc-500">Seleziona una categoria:</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {WIZARD_TREE.categories.map((cat) => (
                <button
                  key={cat.key}
                  className="rounded-xl border border-zinc-300 px-4 py-3 text-left text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  onClick={() => {
                    setActiveCat(cat.key);
                    setAnswers({});
                  }}
                >
                  <div className="font-medium">{cat.label}</div>
                  <div className="text-xs text-zinc-500">{cat.steps.length} passi</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-2 flex items-center gap-2">
              <button
                className="text-xs text-blue-600 underline"
                onClick={() => setActiveCat(null)}
              >
                ← Cambia categoria
              </button>
              <span className="text-sm font-semibold text-zinc-700">{WIZARD_TREE.categories.find(c => c.key === activeCat)?.label}</span>
            </div>
            <div className="grid gap-4">
              {WIZARD_TREE.categories.find(c => c.key === activeCat)?.steps.map((step) => (
                <div key={step.key} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="mb-2 text-sm font-semibold">{step.label}</div>
                  {"choices" in step ? (
                    <div className="flex flex-wrap gap-2">
                      {step.choices.map((ch) => (
                        <button
                          key={ch.key}
                          className={`rounded-lg border px-3 py-1 text-sm ${
                            answers[step.key] === ch.key
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                              : "border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                          }`}
                          onClick={() =>
                            setAnswers((a) => ({ ...a, [step.key]: ch.key }))
                          }
                        >
                          {ch.label}
                        </button>
                      ))}
                    </div>
                  ) : step.type === "number" ? (
                    <input
                      inputMode="numeric"
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-950"
                      value={answers[step.key] ?? ""}
                      onChange={(e) =>
                        setAnswers((a) => ({
                          ...a,
                          [step.key]: e.target.value.replace(/[^0-9]/g, ""),
                        }))
                      }
                      placeholder="0"
                    />
                  ) : (
                    <input
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-950"
                      value={answers[step.key] ?? ""}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [step.key]: e.target.value }))
                      }
                      placeholder="Descrizione"
                    />
                  )}
                </div>
              ))}
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="mb-2 text-sm font-semibold">Opzioni</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={applyCallout}
                      onChange={(e) => setApplyCallout(e.target.checked)}
                    />
                    Applica call-out
                  </label>
                  <div className="text-sm">
                    Tariffa call-out: <strong>{currency(calloutFee)}</strong>
                  </div>
                  <label className="text-sm">
                    Viaggio A/R (min)
                    <input
                      inputMode="numeric"
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-950"
                      value={travelMinutes}
                      onChange={(e) =>
                        setTravelMinutes(
                          Number(String(e.target.value).replace(/[^0-9]/g, "")) || 0
                        )
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800" id="ai-preview">
                <div className="text-sm font-semibold mb-2">Anteprima</div>

                {!category && (
                  <div className="text-sm text-zinc-500">Seleziona una categoria per iniziare.</div>
                )}

                {!!category && !allStepsAnswered && (
                  <div className="text-sm text-zinc-500">
                    Completa le domande qui sopra per vedere il calcolo automatico.
                  </div>
                )}

                {!!category && allStepsAnswered && (() => {
                  const p = computePreviewFromAnswers(answers, category, aiCatalog);
                  if (!p) return null;
                  return (
                    <>
                      <div className="space-y-1 text-sm">
                        <div><span className="text-zinc-500">Descrizione:</span> {p.description}</div>
                        <div><span className="text-zinc-500">Quantità:</span> {p.qta}</div>
                        <div><span className="text-zinc-500">Materiale/unità:</span> {currency(p.materialsPU)}</div>
                        <div><span className="text-zinc-500">Manodopera/unità:</span> {currency(p.laborPU)}</div>
                        <div><span className="text-zinc-500">Netto/unità:</span> <strong>{currency(p.netPU)}</strong></div>
                        <div><span className="text-zinc-500">Viaggio:</span> {currency(p.travelCHF)}</div>
                        {!!p.calloutCHF && (<div><span className="text-zinc-500">Call-out:</span> {currency(p.calloutCHF)}</div>)}
                        <div><span className="text-zinc-500">Subtotale:</span> {currency(p.subtotal)}</div>
                        <div><span className="text-zinc-500">IVA {p.vatPct}%:</span> {currency(p.subtotal * (p.vatPct/100))}</div>
                        <div className="text-base font-semibold">Totale: {currency(p.total)}</div>
                      </div>

                      <div className="mt-3">
                        <button
                          type="button"
                          className="rounded-md border px-3 py-2 text-sm dark:border-zinc-700"
                          onClick={addCurrentToList}
                        >
                          Aggiungi alla lista
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
      <div>
        <div className="mb-2 text-sm font-semibold">Mini-carrello</div>
        {items.length === 0 ? (
          <div className="text-zinc-500 text-sm mb-4">Nessun articolo aggiunto.</div>
        ) : (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-3">Descrizione</th>
                  <th className="py-2 pr-3">Q.tà</th>
                  <th className="py-2 pr-3">Prezzo unitario</th>
                  <th className="py-2 pr-3">Totale riga</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-3">{it.description}</td>
                    <td className="py-2 pr-3">{it.qty}</td>
                    <td className="py-2 pr-3">{currency(it.netPerUnit)}</td>
                    <td className="py-2 pr-3">{currency(it.netPerUnit * it.qty)}</td>
                    <td className="py-2 pr-3">
                      <button
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                        onClick={() => handleRemoveItem(it.id)}
                      >
                        Rimuovi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800 mb-3">
          <div className="text-sm">Materiali + manodopera: <b>{currency(itemsSubtotal)}</b></div>
          <div className="text-sm">Viaggio: <b>{currency(travelCHF)}</b></div>
          <div className="text-sm">Call-out: <b>{currency(calloutCHF)}</b></div>
          <div className="text-sm">Subtotale: <b>{currency(subtotal)}</b></div>
          <div className="text-sm">IVA {vatPct}%: <b>{currency(vat)}</b></div>
          <div className="text-base font-semibold">Totale: {currency(total)}</div>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            onClick={handleClearCart}
          >
            Svuota lista
          </button>
        </div>
      </div>
      {!!items.length && (
        <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="mb-2 text-sm font-semibold">Articoli selezionati</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2 pr-3">Descrizione</th>
                  <th className="py-2 pr-3">Q.tà</th>
                  <th className="py-2 pr-3">Subtotale</th>
                  <th className="py-2 pr-3">Totale</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-2 pr-3">{it.description}</td>
                    <td className="py-2 pr-3">{it.qty}</td>
                    <td className="py-2 pr-3">{currency(it.subtotal)}</td>
                    <td className="py-2 pr-3">{currency(it.total)}</td>
                    <td className="py-2 pr-3">
                      <button className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900" onClick={() => removeItem(i)}>Rimuovi</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <>
            <div className="space-y-1">
              <div>Totale articoli: <strong>{currency(totals.itemsSubtotal)}</strong></div>
              <div>Viaggio: <strong>{currency(totals.travel)}</strong></div>
              {applyCallout && (
                <div>Call-out: <strong>{currency(totals.callout)}</strong></div>
              )}
              <div>IVA complessiva: <strong>{currency(totals.vat)}</strong></div>
              <div className="text-base font-semibold">Totale: {currency(totals.gross)}</div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm"
                onClick={generateOffer}
              >
                Genera offerta
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-2 text-sm"
                onClick={() => setItems([])}
              >
                Svuota lista
              </button>
            </div>
          </>
        </div>
      )}
    </div>
  );
}
