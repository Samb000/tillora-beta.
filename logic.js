
(function () {
  "use strict";

  const localDate = (date) => {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const isDate = (s) => {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + "T12:00:00");
    return !isNaN(d.getTime()) && localDate(d) === s;
  };

  const validState = (s) =>
    !!s &&
    typeof s === "object" &&
    ["GBP", "USD", "EUR", "CAD", "AUD", "INR", "JPY"].includes(s.currency) &&
    typeof s.budget === "number" &&
    Number.isFinite(s.budget) &&
    s.budget > 0 &&
    Array.isArray(s.entries) &&
    s.entries.every((e) =>
      e &&
      typeof e.id === "string" &&
      typeof e.merchant === "string" &&
      typeof e.amount === "number" &&
      Number.isFinite(e.amount) &&
      e.amount > 0 &&
      isDate(e.date) &&
      typeof e.category === "string"
    );

  const totals = (entries, today) => {
    const current = new Date(today + "T12:00:00");
    const monday = new Date(current);
    monday.setDate(current.getDate() - ((current.getDay() + 6) % 7));
    const weekStart = localDate(monday);
    const monthStart = today.slice(0, 7);

    let dayTotal = 0, weekTotal = 0, monthTotal = 0;

    for (const e of entries) {
      if (e.date === today) dayTotal += e.amount;
      if (e.date >= weekStart && e.date <= today) weekTotal += e.amount;
      if (e.date.slice(0, 7) === monthStart && e.date <= today) monthTotal += e.amount;
    }

    return {
      today: dayTotal,
      week: weekTotal,
      month: monthTotal
    };
  };

  const extract = (text) => {
    const lines = String(text || "").split(/\r?\n/);
    const money = /(?:£|\$|€)?\s*(\d{1,6}[.,]\d{2})\b/g;
    let best = null;
    let score = -Infinity;

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (/subtotal|sub total|change|cash given|tendered|vat|tax|saving/.test(lower)) continue;

      const priority = /\b(grand total|total due|amount due|balance due|to pay|total payable)\b/.test(lower)
        ? 10
        : /\btotal\b/.test(lower) ? 5 : 0;

      money.lastIndex = 0;
      let match;
      while ((match = money.exec(line))) {
        const amount = Number(match[1].replace(",", "."));
        if (amount > 0 && amount < 100000 && priority > score) {
          best = amount;
          score = priority;
        }
      }
    }

    const merchant = lines.map(x => x.trim()).find(x =>
      x.length >= 3 && /[a-z]/i.test(x) && !/receipt|invoice|thank you/i.test(x)
    ) || "";

    let date = null;
    const foundDate = String(text || "").match(/\b(\d{2})[\/.-](\d{2})[\/.-](\d{4})\b/);
    if (foundDate) {
      const candidate = `${foundDate[3]}-${foundDate[2]}-${foundDate[1]}`;
      if (isDate(candidate)) date = candidate;
    }

    return { total: best, merchant, date };
  };

  window.ReceiptLogic = { localDate, isDate, validState, totals, extract };
})();
