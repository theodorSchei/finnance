// Load saved settings when popup opens
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const result = await browser.storage.local.get("userSettings");
    if (result.userSettings) {
      document.getElementById("yearlySalary").value =
        result.userSettings.yearlySalary || 0;
      document.getElementById("taxAmount").value =
        result.userSettings.taxAmount || 0;
      document.getElementById("equity").value = result.userSettings.equity || 0;
      document.getElementById("interestRate").value =
        result.userSettings.interestRate || 0;
      document.getElementById("interestTax").value =
        result.userSettings.interestTax || 0;
    }
  } catch (error) {
    console.error("Error loading settings:", error);
    showStatus(
      "Kunne ikke laste inn innstillinger, sjekk konsollen om du er nørd",
      true,
    );
  }
});

function showStatus(message, isError = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.style.color = isError ? "#dc3545" : "#28a745";
  setTimeout(() => {
    status.textContent = "";
    status.style.color = "";
  }, 3000);
}

// Save settings when button is clicked
document.getElementById("saveSettings").addEventListener("click", async () => {
  try {
    const yearlySalary = parseFloat(
      document.getElementById("yearlySalary").value,
    );
    const taxAmount = parseFloat(document.getElementById("taxAmount").value);
    const interestRate = parseFloat(
      document.getElementById("interestRate").value,
    );
    const equity = parseFloat(document.getElementById("equity").value);
    const interestTax = parseFloat(
      document.getElementById("interestTax").value,
    );

    // Validate inputs
    if (
      isNaN(yearlySalary) ||
      isNaN(taxAmount) ||
      isNaN(interestRate) ||
      isNaN(equity) ||
      isNaN(interestTax)
    ) {
      throw new Error("Fyll inn alle felter");
    }

    const userSettings = {
      yearlySalary,
      taxAmount,
      interestRate,
      equity,
      interestTax,
    };

    await browser.storage.local.set({ userSettings });

    // Try to notify content script
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0]) {
        await browser.tabs.sendMessage(tabs[0].id, {
          type: "SETTINGS_UPDATED",
          settings: userSettings,
        });
      }
    } catch (error) {
      console.log("[Finnance] Tab update not needed - might not be on Finn.no");
    }
    showStatus("Endringer lagret!");
  } catch (error) {
    console.error("Error saving settings:", error);
    showStatus(error.message, true);
  }
});
