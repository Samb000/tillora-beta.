
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
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("scanBtn").addEventListener("click", () => {
    document.getElementById("photo").click();
  });
});
// Tillora: improved automatic receipt reading
document.addEventListener("DOMContentLoaded", () => {
  const get = id => document.getElementById(id);
  const read = get("readBtn");

  read.addEventListener("click", async event => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const file = get("photo").files[0];
    if (!file) return;

    const status = get("status");
    read.disabled = true;

    try {
      status.textContent = "Enhancing and reading receipt...";

      if (!window.Tesseract) {
        await new Promise((ok, fail) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
          s.onload = ok;
          s.onerror = fail;
          document.head.append(s);
        });
      }

      const image = await createImageBitmap(file);
      const scale = Math.min(
        2.5,
        2200 / image.width,
        3500 / image.height
      );

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);

      const ctx = canvas.getContext("2d");
      ctx.filter = "grayscale(1) contrast(1.5)";
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();

      let result = (
        await Tesseract.recognize(canvas, "eng")
      ).data;

      if (result.confidence < 70) {
        status.textContent = "Checking original photo...";
        const second = (
          await Tesseract.recognize(file, "eng")
        ).data;

        if (second.confidence > result.confidence) {
          result = second;
        }
      }

      get("rawText").value = result.text;

      const line = result.text.split(/\r?\n/).find(x =>
        /\b(total|amount due|balance due|to pay)\b/i.test(x) &&
        !/subtotal|sub total|change|cash|tender|vat|tax|savings/i.test(x)
      );

      const amounts = line?.match(/\d{1,5}[.,]\d{2}/g) || [];
      const info = window.ReceiptLogic.extract(result.text);
      const amount = Number(
        amounts.at(-1)?.replace(",", ".")
      );
      const shop = info.merchant?.trim();

      if (
        result.confidence >= 70 &&
        amounts.length &&
        amount > 0 &&
        amount < 10000 &&
        shop &&
        /[a-z]{3}/i.test(shop)
      ) {
        get("merchant").value = shop;
        get("value").value = amount.toFixed(2);
        get("purchaseDate").value =
          info.date ||
          window.ReceiptLogic.localDate(new Date());

        get("category").value =
          /tesco|asda|aldi|lidl|sainsbury|morrisons|waitrose/i.test(shop)
            ? "Groceries"
            : /primark|next|zara|h&m/i.test(shop)
              ? "Shopping"
              : "Other";

        status.textContent = "Receipt recognised. Saving...";
        get("entryForm").requestSubmit();
      } else {
        status.textContent =
          "Could not read receipt reliably. Retake the photo. Nothing was saved.";
      }
    } catch (error) {
      status.textContent = "Scan failed: " + error.message;
    } finally {
      read.disabled = false;
    }
  }, true);
});


