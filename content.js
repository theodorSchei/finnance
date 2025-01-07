// Store user settings
let userSettings = null;

function checkAndUpdatePriceGrid(forceUpdate = false) {
  const totalPriceElement = document.querySelector(
    '[data-testid="pricing-total-price"] dd',
  );
  const monthlyFeesElement = document.querySelector(
    '[data-testid="pricing-common-monthly-cost"] dd',
  );
  const municipalFeesElement = document.querySelector(
    '[data-testid="pricing-municipal-fees"] dd',
  );
  const priceGrid = document.querySelector("dl.grid");

  if (
    !priceGrid ||
    !totalPriceElement ||
    !(monthlyFeesElement || municipalFeesElement)
  ) {
    return false;
  }

  const existingMonthly = document.querySelector(
    '[data-testid="monthly-payment"]',
  );
  const existingRemaining = document.querySelector(
    '[data-testid="remaining-salary"]',
  );

  // Update if elements are missing OR if we're forcing an update
  if (!existingMonthly || !existingRemaining || forceUpdate) {
    console.log(
      forceUpdate
        ? "[Finnance] Force updating price grid"
        : "[Finnance] Updating missing price grid elements",
    );
    updatePriceGrid();
  }

  return true;
}

// Initialize when settings are loaded
browser.storage.local.get("userSettings").then((result) => {
  if (result.userSettings) {
    userSettings = result.userSettings;
    console.log("[Finnance] Loaded initial settings:", userSettings);

    if (checkAndUpdatePriceGrid(true)) {
      // Force update on initial load
      setupPriceGridObserver();
    } else {
      startPolling();
    }
  }
});

function startPolling() {
  console.log("[Finnance] Starting to poll for initial elements...");
  const pollInterval = setInterval(() => {
    if (checkAndUpdatePriceGrid(true)) {
      // Force update when found during polling
      console.log("[Finnance] Initial elements found, setting up observer");
      clearInterval(pollInterval);
      setupPriceGridObserver();
    }
  }, 100);

  setTimeout(() => {
    clearInterval(pollInterval);
  }, 10000);
}

function setupPriceGridObserver() {
  const priceGrid = document.querySelector("dl.grid");
  if (!priceGrid) return;

  console.log("[Finnance] Setting up mutation observer for price grid");

  const observer = new MutationObserver((mutations) => {
    requestAnimationFrame(() => {
      if (userSettings) {
        checkAndUpdatePriceGrid(false); // Don't force update for DOM changes
      }
    });
  });

  observer.observe(priceGrid, {
    childList: true,
    subtree: true,
    characterData: false,
    attributes: false,
  });
}

// Listen for settings updates
browser.runtime.onMessage.addListener((message) => {
  if (message.type === "SETTINGS_UPDATED") {
    userSettings = message.settings;
    console.log("[Finnance] Received new settings:", userSettings);
    checkAndUpdatePriceGrid(true); // Force update when settings change
  }
});

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

  if (!totalPriceElement || (!monthlyFeesElement && !municipalFeesElement)) {
    console.log("[Finnance] Missing price elements, can't update grid");
    return;
  }

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

  console.log("[Finnance] Updating price grid...");

  // Get or create monthly payment div
  let monthlyPaymentDiv = document.querySelector(
    '[data-testid="monthly-payment"]',
  );
  if (!monthlyPaymentDiv) {
    // Create new element if it doesn't exist
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
    priceGrid.appendChild(monthlyPaymentDiv);
  }

  // Always update content
  monthlyPaymentDiv.innerHTML = `
        <dt class="m-0">Månedlig kostnad (uten avdrag)</dt>
        <dd class="m-0 font-bold">${formatPrice(Math.round(totalMonthlyPayment))}</dd>
    `;
  // Re-add tooltip after innerHTML update
  const monthlyTooltip = createTooltip(monthlyCalcText);
  monthlyPaymentDiv.appendChild(monthlyTooltip);

  // Get or create remaining salary div
  let remainingSalaryDiv = document.querySelector(
    '[data-testid="remaining-salary"]',
  );
  if (!remainingSalaryDiv) {
    // Create new element if it doesn't exist
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
    priceGrid.appendChild(remainingSalaryDiv);
  }

  // Always update content
  remainingSalaryDiv.innerHTML = `
        <dt class="m-0">Gjenværende lønn/mnd</dt>
        <dd class="m-0 font-bold">${formatPrice(Math.round(remainingSalary))}</dd>
    `;
  // Re-add tooltip after innerHTML update
  const salaryTooltip = createTooltip(salaryCalcText);
  remainingSalaryDiv.appendChild(salaryTooltip);
}
