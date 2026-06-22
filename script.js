// ===================================================================
//  CONFIG  — paste your deployed Apps Script Web App URL here
// ===================================================================
const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzXcZ3spL2UPwk9-uIZ6MfFj7H-IQdj8Z1RM7QXTOv-hiE-GzTVKS4W6ne8QKk4dSb6zg/exec",
  AMOUNT_PER_MEMBER: 1, // TEMP ₹1 for test (set back to 500 for live!)
};

// ===== Shared field definition (member columns / Excel headers) =====
const MEMBER_HEADERS = [
  "First Name", "Last Name", "Address 1", "Address 2", "Address 3",
  "Pincode", "City", "State", "Mobile", "Email", "Alternate Mobile",
];

// ---------- Post-payment result banner ----------
// After PayU, the backend sends the user back here with ?status=success|failed.
(function showPaymentResult() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  if (!status) return;

  const txnid = params.get("txnid") || "";
  const banner = document.createElement("div");
  banner.className = "result-banner " + (status === "success" ? "ok" : "fail");
  banner.innerHTML =
    status === "success"
      ? "<h2>✓ Payment Successful</h2><p>Your subscription has been saved. Thank you!</p>" +
        (txnid ? "<p class='txn'>Transaction ID: <b>" + txnid + "</b></p>" : "")
      : "<h2>Payment Failed</h2><p>No charge was completed. You can try again below.</p>";

  const card = document.querySelector(".card");
  card.insertBefore(banner, card.firstChild);
  banner.scrollIntoView({ behavior: "smooth", block: "start" });

  // Clean the URL so a refresh doesn't keep showing the banner.
  window.history.replaceState({}, document.title, window.location.pathname);
})();

// ---------- Warning helpers ----------
const warningEl = document.getElementById("formWarning");

function showWarning(msg) {
  warningEl.textContent = "★ " + msg;
  warningEl.classList.add("show");
  warningEl.scrollIntoView({ behavior: "smooth", block: "center" });
}
function clearWarning() {
  warningEl.textContent = "";
  warningEl.classList.remove("show");
}

// ---------- Character counters (renewal address fields) ----------
function wireCounters(scope) {
  scope.querySelectorAll(".counter").forEach((counter) => {
    const input = document.getElementById(counter.dataset.for);
    if (!input) return;
    const max = input.getAttribute("maxlength") || 40;
    const update = () => (counter.textContent = `${input.value.length}/${max}`);
    input.addEventListener("input", update);
    update();
  });
}
wireCounters(document);

// ---------- Generic Pincode -> City & State auto-fill ----------
async function lookupPincode(pincode, cityEl, stateEl, statusEl) {
  statusEl.textContent = "Looking up…";
  statusEl.className = "status pincode-status loading";
  cityEl.value = "";
  stateEl.value = "";
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await res.json();
    const result = data[0];
    if (result.Status === "Success" && result.PostOffice && result.PostOffice.length) {
      const office = result.PostOffice[0];
      cityEl.value = office.District || office.Block || office.Name || "";
      stateEl.value = office.State || "";
      statusEl.textContent = "✓ Found";
      statusEl.className = "status pincode-status success";
    } else {
      statusEl.textContent = "Invalid pincode";
      statusEl.className = "status pincode-status error";
    }
  } catch (err) {
    statusEl.textContent = "Network error — enter city/state manually";
    statusEl.className = "status pincode-status error";
  }
}

function wirePincode(scope) {
  const pin = scope.querySelector(".pincode-input");
  const city = scope.querySelector(".city-input");
  const state = scope.querySelector(".state-input");
  const status = scope.querySelector(".pincode-status");
  if (!pin) return;
  pin.addEventListener("input", () => {
    pin.value = pin.value.replace(/\D/g, "");
    if (pin.value.length === 6) {
      lookupPincode(pin.value, city, state, status);
    } else {
      city.value = "";
      state.value = "";
      status.textContent = "";
      status.className = "status pincode-status";
    }
  });
}
document.querySelectorAll(".pincode-scope").forEach(wirePincode);

// ---------- Numeric-only for mobile fields (event delegation) ----------
document.addEventListener("input", (e) => {
  if (e.target.classList.contains("mobile-input")) {
    e.target.value = e.target.value.replace(/\D/g, "");
  }
});

// ===================================================================
//  MODE TOGGLE (Renewal / Gift)
// ===================================================================
const modeButtons = document.querySelectorAll(".mode-btn");
const sections = {
  renewal: document.getElementById("renewalForm"),
  gift: document.getElementById("giftForm"),
};

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    clearWarning();
    modeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    Object.values(sections).forEach((s) => s.classList.remove("active"));
    sections[btn.dataset.mode].classList.add("active");
  });
});

// ===================================================================
//  GIFT MODE
// ===================================================================
const memberCountInput = document.getElementById("memberCount");
const membersContainer = document.getElementById("membersContainer");
const giftedByBlock = document.getElementById("giftedByBlock");
const bulkBlock = document.getElementById("bulkBlock");
const giftSubmit = document.getElementById("giftSubmit");
const bulkCount = document.getElementById("bulkCount");

// Build one member block's HTML
function memberBlockHTML(i) {
  return `
    <div class="member-block">
      <h3 class="block-title">Member ${i}</h3>
      <div class="field">
        <label>First Name <span class="req">*</span></label>
        <input type="text" class="m-firstName" required />
      </div>
      <div class="field">
        <label>Last Name <span class="req">*</span></label>
        <input type="text" class="m-lastName" required />
      </div>
      <div class="field">
        <label>Address 1 <span class="req">*</span></label>
        <input type="text" class="m-address1" maxlength="40" required />
      </div>
      <div class="field">
        <label>Address 2 <span class="req">*</span></label>
        <input type="text" class="m-address2" maxlength="40" required />
      </div>
      <div class="field">
        <label>Address 3</label>
        <input type="text" class="m-address3" maxlength="40" />
      </div>
      <div class="field-row pincode-scope">
        <div class="field">
          <label>Pincode <span class="req">*</span></label>
          <input type="text" class="pincode-input" inputmode="numeric" maxlength="6" placeholder="6-digit" required />
          <span class="status pincode-status"></span>
        </div>
        <div class="field">
          <label>City <span class="req">*</span></label>
          <input type="text" class="city-input" placeholder="Auto-filled" required />
        </div>
        <div class="field">
          <label>State <span class="req">*</span></label>
          <input type="text" class="state-input" placeholder="Auto-filled" required />
        </div>
      </div>
      <div class="field">
        <label>Mobile Number <span class="req">*</span></label>
        <input type="text" class="m-mobile mobile-input" inputmode="numeric" maxlength="10" placeholder="Mobile number" required />
      </div>
      <div class="field">
        <label>Email ID</label>
        <input type="email" class="m-email" placeholder="Optional" />
      </div>
      <div class="field">
        <label>Alternate Mobile / WhatsApp Number</label>
        <input type="text" class="m-altMobile mobile-input" inputmode="numeric" maxlength="10" placeholder="Optional" />
      </div>
    </div>`;
}

function renderMembers(n) {
  let html = "";
  for (let i = 1; i <= n; i++) html += memberBlockHTML(i);
  membersContainer.innerHTML = html;
  // wire pincode auto-fill for each new member block
  membersContainer.querySelectorAll(".pincode-scope").forEach(wirePincode);
}

// Build the headers list chips + bulk template once
const headersList = document.getElementById("headersList");
headersList.innerHTML = MEMBER_HEADERS.map((h) => `<span>${h}</span>`).join("");

const giftAmountBox = document.getElementById("giftAmountBox");
const giftAmount = document.getElementById("giftAmount");
const giftAmountSub = document.getElementById("giftAmountSub");

function updateGiftAmount(n) {
  const total = n * CONFIG.AMOUNT_PER_MEMBER;
  giftAmount.textContent = "₹" + total.toLocaleString("en-IN");
  giftAmountSub.textContent = `(${n} member${n > 1 ? "s" : ""} × ₹${CONFIG.AMOUNT_PER_MEMBER})`;
  giftAmountBox.hidden = false;
}

memberCountInput.addEventListener("input", () => {
  clearWarning();
  const n = parseInt(memberCountInput.value, 10);

  if (!n || n < 1) {
    membersContainer.innerHTML = "";
    giftedByBlock.hidden = true;
    bulkBlock.hidden = true;
    giftSubmit.hidden = true;
    giftAmountBox.hidden = true;
    return;
  }

  if (n <= 5) {
    renderMembers(n);
    giftedByBlock.hidden = false;
    bulkBlock.hidden = true;
  } else {
    membersContainer.innerHTML = "";
    giftedByBlock.hidden = true;
    bulkBlock.hidden = false;
    bulkCount.textContent = n;
  }
  updateGiftAmount(n);
  giftSubmit.hidden = false;
});

// ---------- Download CSV template (opens in Excel) ----------
document.getElementById("downloadTemplate").addEventListener("click", () => {
  const csv = MEMBER_HEADERS.join(",") + "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kalyan_gift_members_template.csv";
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- Show selected file name ----------
const bulkFile = document.getElementById("bulkFile");
const bulkFileStatus = document.getElementById("bulkFileStatus");
bulkFile.addEventListener("change", () => {
  if (bulkFile.files.length) {
    bulkFileStatus.textContent = "✓ Selected: " + bulkFile.files[0].name;
    bulkFileStatus.className = "status success";
  } else {
    bulkFileStatus.textContent = "";
  }
});

// ===================================================================
//  VALIDATION + SUBMIT
// ===================================================================
function valid(el) {
  return el && el.value.trim() !== "";
}

// Reads inputs in a scope into a member object using the column order in MEMBER_HEADERS
function readMember(scope, sel) {
  return {
    "First Name": scope.querySelector(sel.first).value.trim(),
    "Last Name": scope.querySelector(sel.last).value.trim(),
    "Address 1": scope.querySelector(sel.a1).value.trim(),
    "Address 2": scope.querySelector(sel.a2).value.trim(),
    "Address 3": scope.querySelector(sel.a3).value.trim(),
    "Pincode": scope.querySelector(".pincode-input").value.trim(),
    "City": scope.querySelector(".city-input").value.trim(),
    "State": scope.querySelector(".state-input").value.trim(),
    "Mobile": scope.querySelector(sel.mob).value.trim(),
    "Email": scope.querySelector(sel.email).value.trim(),
    "Alternate Mobile": scope.querySelector(sel.alt).value.trim(),
  };
}

// Builds a hidden form and POSTs the payload to Apps Script (full-page navigation -> PayU)
function proceedToPayment(payload) {
  if (CONFIG.APPS_SCRIPT_URL.startsWith("PASTE_")) {
    showWarning("Payment is not configured yet. Add your Apps Script URL in script.js (see SETUP.md).");
    return;
  }
  const form = document.createElement("form");
  form.method = "POST";
  form.action = CONFIG.APPS_SCRIPT_URL;
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "payload";
  input.value = JSON.stringify(payload);
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
}

// ----- Renewal submit -----
document.getElementById("renewalForm").addEventListener("submit", (e) => {
  e.preventDefault();
  clearWarning();
  const f = e.target;
  const required = [
    "#firstName", "#lastName", "#address1", "#address2",
    ".pincode-input", ".city-input", ".state-input", "#mobile",
  ];
  for (const sel of required) {
    const el = f.querySelector(sel);
    if (!valid(el)) {
      el.focus();
      showWarning("Please fill all required fields marked with *");
      return;
    }
  }
  if (f.querySelector("#mobile").value.length !== 10) {
    f.querySelector("#mobile").focus();
    showWarning("Mobile number must be 10 digits");
    return;
  }

  const member = {
    "First Name": f.querySelector("#firstName").value.trim(),
    "Last Name": f.querySelector("#lastName").value.trim(),
    "Address 1": f.querySelector("#address1").value.trim(),
    "Address 2": f.querySelector("#address2").value.trim(),
    "Address 3": f.querySelector("#address3").value.trim(),
    "Pincode": f.querySelector(".pincode-input").value.trim(),
    "City": f.querySelector(".city-input").value.trim(),
    "State": f.querySelector(".state-input").value.trim(),
    "Mobile": f.querySelector("#mobile").value.trim(),
    "Email": f.querySelector("#email").value.trim(),
    "Alternate Mobile": f.querySelector("#altMobile").value.trim(),
  };

  proceedToPayment({
    mode: "renewal",
    count: 1,
    amount: CONFIG.AMOUNT_PER_MEMBER,
    buyer: { name: member["First Name"] + " " + member["Last Name"], mobile: member["Mobile"], email: member["Email"] },
    members: [member],
  });
});

// ----- Gift submit -----
document.getElementById("giftForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearWarning();
  const n = parseInt(memberCountInput.value, 10);

  if (!n || n < 1) {
    showWarning("Please enter how many members you want to gift");
    return;
  }

  const buyer = {
    name: document.getElementById("giftedByName").value.trim(),
    mobile: document.getElementById("giftedByMobile").value.trim(),
    email: document.getElementById("giftedByEmail").value.trim(),
  };

  if (n <= 5) {
    const blocks = membersContainer.querySelectorAll(".member-block");
    const members = [];
    for (let b = 0; b < blocks.length; b++) {
      const block = blocks[b];
      const req = [".m-firstName", ".m-lastName", ".m-address1", ".m-address2",
        ".pincode-input", ".city-input", ".state-input", ".m-mobile"];
      for (const sel of req) {
        const el = block.querySelector(sel);
        if (!valid(el)) {
          el.focus();
          showWarning(`Please complete all required fields for Member ${b + 1}`);
          return;
        }
      }
      if (block.querySelector(".m-mobile").value.length !== 10) {
        block.querySelector(".m-mobile").focus();
        showWarning(`Member ${b + 1}: mobile number must be 10 digits`);
        return;
      }
      members.push(readMember(block, {
        first: ".m-firstName", last: ".m-lastName", a1: ".m-address1", a2: ".m-address2",
        a3: ".m-address3", mob: ".m-mobile", email: ".m-email", alt: ".m-altMobile",
      }));
    }

    // Gifted By is required for the payment receipt
    if (!buyer.name || !buyer.mobile || !buyer.email) {
      showWarning("Please fill the 'Gifted By' name, mobile and email");
      return;
    }

    proceedToPayment({
      mode: "gift",
      count: members.length,
      amount: members.length * CONFIG.AMOUNT_PER_MEMBER,
      buyer: buyer,
      members: members,
    });
  } else {
    // ----- Bulk mode: read members from the uploaded Excel/CSV -----
    if (!bulkFile.files.length) {
      showWarning("Please upload the Excel/CSV sheet with member details");
      return;
    }
    if (!buyer.name || !buyer.mobile || !buyer.email) {
      // Gifted By block is hidden in bulk mode, so collect it inline instead
      // (kept simple: reuse the same fields if you later show them in bulk mode)
    }

    let rows;
    try {
      rows = await parseSheet(bulkFile.files[0]);
    } catch (err) {
      showWarning("Could not read the file. Please use the provided template.");
      return;
    }

    if (!rows.length) {
      showWarning("The uploaded sheet has no member rows.");
      return;
    }

    proceedToPayment({
      mode: "gift-bulk",
      count: rows.length,
      amount: rows.length * CONFIG.AMOUNT_PER_MEMBER,
      buyer: buyer.name ? buyer : { name: "Bulk Gift", mobile: "", email: "" },
      members: rows,
    });
  }
});

// Parse uploaded .xlsx/.xls/.csv into an array of member objects keyed by MEMBER_HEADERS
function parseSheet(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        // Normalize to our header set
        const rows = json.map((r) => {
          const out = {};
          MEMBER_HEADERS.forEach((h) => (out[h] = String(r[h] != null ? r[h] : "").trim()));
          return out;
        }).filter((r) => r["First Name"] || r["Mobile"]); // drop blank rows
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
