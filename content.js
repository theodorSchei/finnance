// Store user settings
let userSettings = null;

function parsePriceString(priceStr) {
  return parseInt(priceStr.replace(/[^0-9]/g, "")) || 0;
}

function formatPrice(number) {
  return new Intl.NumberFormat("nb-NO").format(number) + " kr";
}

function createTooltip(text) {
  const tooltip = document.createElement("div");
  tooltip.style.cssText = `
        position: absolute;
        background: white;
        padding: 12px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 1000;
        max-width: 300px;
        font-size: 14px;
        display: none;
        white-space: pre-line;
    `;
  tooltip.textContent = text;
  return tooltip;
}

function updatePriceGrid() {
  if (!userSettings) return;

  const priceGrid = document.querySelector("dl.grid");
  if (!priceGrid) return;

  const totalPriceElement = document.querySelector(
    '[data-testid="pricing-total-price"] dd',
  );
  const monthlyFeesElement = document.querySelector(
    '[data-testid="pricing-common-monthly-cost"] dd',
  );
  const municipalFeesElement = document.querySelector(
    '[data-testid="pricing-municipal-fees"] dd',
  );

  if (!totalPriceElement || (!monthlyFeesElement && !municipalFeesElement))
    return;

  const totalPrice = parsePriceString(totalPriceElement.textContent);
  const totalPriceMinusEquity = totalPrice - userSettings.equity;
  const monthlyFees = monthlyFeesElement
    ? parsePriceString(monthlyFeesElement.textContent)
    : parsePriceString(municipalFeesElement.textContent) / 12;

  const monthlyLoanPayment =
    ((totalPriceMinusEquity / 12) * userSettings.interestRate) / 100;
  const monthlyInterestTax =
    monthlyLoanPayment * (userSettings.interestTax / 100);
  const totalMonthlyPayment =
    monthlyLoanPayment - monthlyInterestTax + monthlyFees;

  const monthlyGrossSalary = userSettings.yearlySalary / 12;
  const monthlyNetSalary =
    monthlyGrossSalary * (1 - userSettings.taxAmount / 100);
  const remainingSalary = monthlyNetSalary - totalMonthlyPayment;

  const monthlyCalcText = `Lånesum etter egenkapital: ${formatPrice(totalPrice)} - ${formatPrice(userSettings.equity)} = ${formatPrice(totalPriceMinusEquity)}\n
        Månedlig lånebetaling: ${formatPrice(totalPriceMinusEquity)} ÷ 12 × ${userSettings.interestRate.toFixed(2)}% = ${formatPrice(Math.round(monthlyLoanPayment))}\n
        Månedlig rentefradrag: ${formatPrice(Math.round(monthlyLoanPayment))} × ${userSettings.interestTax.toFixed(2)}% = ${formatPrice(Math.round(monthlyInterestTax))}\n
        Total månedlig kostnad: ${formatPrice(Math.round(monthlyLoanPayment))} - ${Math.round(monthlyInterestTax)} + ${formatPrice(monthlyFees)} = ${formatPrice(Math.round(totalMonthlyPayment))}\n
        Forklaring: Total månedlig kostnad inkluderer lånebetaling og felleskostnader/kommunale avgifter, og trekker fra skattefradrag.`;

  const salaryCalcText = `Lønn og gjenværende beløp:\n
        Månedlig bruttolønn: ${formatPrice(userSettings.yearlySalary)} ÷ 12 = ${formatPrice(Math.round(monthlyGrossSalary))}\n
        Månedlig nettolønn: ${formatPrice(Math.round(monthlyGrossSalary))} × (100% - ${userSettings.taxAmount}%) = ${formatPrice(Math.round(monthlyNetSalary))}\n
        Gjenværende beløp etter betalinger: ${formatPrice(Math.round(monthlyNetSalary))} - ${formatPrice(Math.round(totalMonthlyPayment))} = ${formatPrice(Math.round(remainingSalary))}\n
        Forklaring: Gjenværende beløp viser hvor mye som er igjen etter månedlige kostnader.`;

  let monthlyPaymentDiv = document.querySelector(
    '[data-testid="monthly-payment"]',
  );
  let remainingSalaryDiv = document.querySelector(
    '[data-testid="remaining-salary"]',
  );

  console.log("[Finnance] Updating price grid...");

  if (!monthlyPaymentDiv) {
    monthlyPaymentDiv = document.createElement("div");
    monthlyPaymentDiv.setAttribute("data-testid", "monthly-payment");
    const monthlyTooltip = createTooltip(monthlyCalcText);
    monthlyPaymentDiv.appendChild(monthlyTooltip);

    monthlyPaymentDiv.addEventListener("mouseenter", () => {
      monthlyTooltip.style.display = "block";
    });
    monthlyPaymentDiv.addEventListener("mouseleave", () => {
      monthlyTooltip.style.display = "none";
    });

    monthlyPaymentDiv.innerHTML = `
            <dt class="m-0">Månedlig kostnad (uten avdrag)</dt>
            <dd class="m-0 font-bold">${formatPrice(Math.round(totalMonthlyPayment))}</dd>
        `;
    monthlyPaymentDiv.appendChild(monthlyTooltip);
    priceGrid.appendChild(monthlyPaymentDiv);
  }

  if (!remainingSalaryDiv) {
    remainingSalaryDiv = document.createElement("div");
    remainingSalaryDiv.setAttribute("data-testid", "remaining-salary");
    const salaryTooltip = createTooltip(salaryCalcText);
    remainingSalaryDiv.appendChild(salaryTooltip);

    remainingSalaryDiv.addEventListener("mouseenter", () => {
      salaryTooltip.style.display = "block";
    });
    remainingSalaryDiv.addEventListener("mouseleave", () => {
      salaryTooltip.style.display = "none";
    });

    remainingSalaryDiv.innerHTML = `
            <dt class="m-0">Gjenværende lønn/mnd</dt>
            <dd class="m-0 font-bold">${formatPrice(Math.round(remainingSalary))}</dd>
        `;
    remainingSalaryDiv.appendChild(salaryTooltip);
    priceGrid.appendChild(remainingSalaryDiv);
  }
}

let updateTimeout = null;

// Debounce function
function debounce(func, wait) {
  return (...args) => {
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => func(...args), wait);
  };
}

// Debounced version of updatePriceGrid
const debouncedUpdate = debounce(updatePriceGrid, 250);

// Initialize
browser.storage.local.get("userSettings").then((result) => {
  if (result.userSettings) {
    userSettings = result.userSettings;
    debouncedUpdate();
  }
});

// Listen for settings updates
browser.runtime.onMessage.addListener((message) => {
  if (message.type === "SETTINGS_UPDATED") {
    userSettings = message.settings;
    debouncedUpdate();
  }
});

// Optimized observer
const observer = new MutationObserver(debouncedUpdate);

// Start observing only after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
} else {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}
