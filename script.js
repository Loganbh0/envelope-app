// ===========================
// Envelope App (multi-user)
// ===========================

let envelopes = [];         // current user's envelopes
let transactions = [];      // normalized transactions for current upload
let txIndex = 0;            // pointer during expense categorization
let currentUser = null;     // username string

// --- DOM lookups ---
const authSection = document.getElementById("authSection");
const loginBtn = document.getElementById("loginBtn");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

const appSection = document.getElementById("appSection");
const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");
const deleteUserBtn = document.getElementById("deleteUserBtn");

const showNewEnvelopeBtn = document.getElementById("showNewEnvelope");
const newEnvelopeForm = document.getElementById("newEnvelopeForm");
const envTitleInput = document.getElementById("envTitle");
const envBalanceInput = document.getElementById("envBalance");
const envTargetInput = document.getElementById("envTarget");
const createEnvelopeBtn = document.getElementById("createEnvelopeBtn");
const cancelEnvelopeBtn = document.getElementById("cancelEnvelopeBtn");
const envelopeList = document.getElementById("envelopeList");
const totalBalanceSpan = document.getElementById("totalBalance");

const fileInput = document.getElementById("fileInput");
const transactionsSection = document.getElementById("transactionsSection");
const transactionsTableWrapper = document.getElementById("transactionsTableWrapper");
const toggleTxBtn = document.getElementById("toggleTxBtn");

// Income modal elements
const incomeModalEl = document.getElementById("incomeModal");
const incomeListEl = document.getElementById("incomeList");
const allocationFormEl = document.getElementById("allocationForm");
const remainingIncomeEl = document.getElementById("remainingIncome");
const negativeWarningEl = document.getElementById("negativeWarning");
const saveAllocationsBtn = document.getElementById("saveAllocationsBtn");

// Expense modal elements
const expenseModalEl = document.getElementById("expenseModal");
const expenseModal = new bootstrap.Modal(expenseModalEl); // single instance to avoid backdrop stacking
const expenseTxInfo = document.getElementById("expenseTxInfo");
const expenseEnvelopeButtons = document.getElementById("expenseEnvelopeButtons");
const skipExpenseBtn = document.getElementById("skipExpenseBtn");

// Edit/Delete envelope modals
const envelopeModalEl = document.getElementById("envelopeModal");
const saveModalBtn = document.getElementById("saveModalBtn");
const modalTitle = document.getElementById("modalTitle");
const modalBalance = document.getElementById("modalBalance");
const modalTarget = document.getElementById("modalTarget");

const deleteEnvelopeModalEl = document.getElementById("deleteEnvelopeModal");
const deleteEnvelopeMessage = document.getElementById("deleteEnvelopeMessage");
const confirmDeleteEnvelopeBtn = document.getElementById("confirmDeleteEnvelopeBtn");

const deleteUserModalEl = document.getElementById("deleteUserModal");
const deleteUserMessage = document.getElementById("deleteUserMessage");
const confirmDeleteUserBtn = document.getElementById("confirmDeleteUserBtn");

// --- Merchant memory (persisted globally). If you prefer per-user memory, key by `merchantMemory_${currentUser}`. ---
let merchantMemory = JSON.parse(localStorage.getItem("merchantMemory") || "{}");
function saveMerchantMemory() {
    localStorage.setItem("merchantMemory", JSON.stringify(merchantMemory));
}

// --- Storage helpers ---
function saveEnvelopesForUser(user, envs) {
    localStorage.setItem(`envelopes_${user}`, JSON.stringify(envs));
}
function loadEnvelopesForUser(user) {
    const raw = localStorage.getItem(`envelopes_${user}`);
    return raw ? JSON.parse(raw) : [];
}

// --- Utils ---
function fmt(n) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}
function uid() {
    return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
// Normalize merchant string: strip numbers, special chars, lowercase, trim
function normalizeMerchant(desc) {
    if (!desc) return "";
    return desc
        .toLowerCase()
        .replace(/[^a-z\s]/g, "")   // remove everything except letters and spaces
        .replace(/\s+/g, " ")       // collapse multiple spaces
        .trim();
}

// ===========================
// Render Envelopes + Total
// ===========================
function renderEnvelopes() {
    // Total at top
    const total = envelopes.reduce((sum, e) => sum + (parseFloat(e.balance) || 0), 0);
    totalBalanceSpan.textContent = `Total: ${fmt(total)}`;

    if (!envelopes.length) {
        envelopeList.innerHTML = `<p class="text-muted m-2">No envelopes yet. Click “New Envelope”.</p>`;
        return;
    }

    // Envelope cards
    envelopeList.innerHTML = envelopes.map(env => {
        const balance = parseFloat(env.balance) || 0;
        const balanceClass = balance >= 0 ? "text-success" : "text-danger";
        const target = parseFloat(env.target) || 0;
        const percent = target ? Math.min((balance / target) * 100, 100) : 0;

        return `
      <div class="col-md-4">
        <div class="card shadow-sm p-3 h-100">
          <h5 class="card-title">${env.title}</h5>
          <p class="card-text fs-5 fw-bold ${balanceClass}">${fmt(balance)}</p>
          ${target ? `
            <p class="small text-muted mb-1">${fmt(balance)} / ${fmt(target)}</p>
            <div class="progress mb-2">
              <div class="progress-bar bg-success" role="progressbar" style="width:${percent}%"></div>
            </div>` : ``}
          <div class="d-flex gap-2 mt-2">
            <button class="btn btn-sm btn-outline-primary" onclick="editEnvelope('${env.id}')"><i class="bi bi-pencil"></i> Edit</button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteEnvelope('${env.id}')"><i class="bi bi-trash"></i> Delete</button>
          </div>
        </div>
      </div>
    `;
    }).join("");
}

// ===========================
// Edit / Delete Envelope (modals)
// ===========================
let envelopeToEdit = null;
let envelopeToDelete = null;

function editEnvelope(id) {
    envelopeToEdit = envelopes.find(e => e.id === id);
    if (!envelopeToEdit) return;

    modalTitle.value = envelopeToEdit.title;
    modalBalance.value = envelopeToEdit.balance;
    modalTarget.value = envelopeToEdit.target || "";

    new bootstrap.Modal(envelopeModalEl).show();
}

saveModalBtn.addEventListener("click", () => {
    if (!envelopeToEdit) return;
    envelopeToEdit.title = modalTitle.value.trim() || envelopeToEdit.title;
    envelopeToEdit.balance = parseFloat(modalBalance.value) || 0;
    envelopeToEdit.target = parseFloat(modalTarget.value) || 0;

    saveEnvelopesForUser(currentUser, envelopes);
    renderEnvelopes();
    bootstrap.Modal.getInstance(envelopeModalEl).hide();
    envelopeToEdit = null;
});

function deleteEnvelope(id) {
    envelopeToDelete = envelopes.find(e => e.id === id);
    if (!envelopeToDelete) return;

    deleteEnvelopeMessage.textContent = `Are you sure you want to delete the envelope "${envelopeToDelete.title}"?`;
    new bootstrap.Modal(deleteEnvelopeModalEl).show();
}

confirmDeleteEnvelopeBtn.addEventListener("click", () => {
    if (!envelopeToDelete) return;
    envelopes = envelopes.filter(e => e.id !== envelopeToDelete.id);
    saveEnvelopesForUser(currentUser, envelopes);
    renderEnvelopes();
    bootstrap.Modal.getInstance(deleteEnvelopeModalEl).hide();
    envelopeToDelete = null;
});

// ===========================
// New Envelope Form
// ===========================
function toggleNewEnvelopeForm(show) {
    newEnvelopeForm.classList.toggle("d-none", !show);
    if (!show) {
        envTitleInput.value = "";
        envBalanceInput.value = "";
        envTargetInput.value = "";
    }
}

function createEnvelope() {
    const title = envTitleInput.value.trim();
    const balance = parseFloat(envBalanceInput.value) || 0;
    const target = parseFloat(envTargetInput.value) || 0;
    if (!title) return alert("Enter a title");

    envelopes.push({ id: uid(), title, balance, target });
    saveEnvelopesForUser(currentUser, envelopes);
    renderEnvelopes();
    toggleNewEnvelopeForm(false);
}

// ===========================
// Transactions table (reference)
// ===========================
function renderTransactionsTable() {
    if (!transactions.length) {
        transactionsSection.classList.add("d-none");
        transactionsTableWrapper.innerHTML = "";
        return;
    }
    transactionsSection.classList.remove("d-none");
    const headers = Object.keys(transactions[0]);
    const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>`;
    const tbody = `<tbody>${transactions.map(r =>
        `<tr>${headers.map(h => `<td>${r[h] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>`;
    transactionsTableWrapper.innerHTML = `<table class="table table-striped table-hover">${thead}${tbody}</table>`;
}

// collapse/expand the table for clarity
toggleTxBtn.addEventListener("click", () => {
    transactionsTableWrapper.classList.toggle("d-none");
});

// ===========================
// Normalization (CSV/XLSX)
// ===========================
function normalizeRow(row) {
    // standardize description and skip "RunningBalance" rows
    const description =
        row.Description || row.Details || row["Transaction Description"] || row["Transaction Details"] || "";

    if (description && description.toLowerCase().includes("runningbalance")) {
        return null;
    }

    // OPTIONAL: ignore CHASE payment rows. Uncomment to activate.
    // if (description && description.toLowerCase().includes("chase")) return null;

    let amount = 0;

    // 1) Single Amount column
    if (row.Amount !== undefined) {
        amount = parseFloat(row.Amount) || 0;
    }
    // 2) Credit/Debit schema
    else if (row.Credit !== undefined || row.Debit !== undefined) {
        const credit = typeof row.Credit === "string" ? parseFloat(row.Credit.replace(/[^0-9.-]+/g, "")) : (parseFloat(row.Credit) || 0);
        const debit = typeof row.Debit === "string" ? parseFloat(row.Debit.replace(/[^0-9.-]+/g, "")) : (parseFloat(row.Debit) || 0);
        amount = credit - debit;
    }
    // 3) Income/Expense schema
    else if (row.Income !== undefined || row.Expense !== undefined) {
        const inc = typeof row.Income === "string" ? parseFloat(row.Income.replace(/[^0-9.-]+/g, "")) : (parseFloat(row.Income) || 0);
        const exp = typeof row.Expense === "string" ? parseFloat(row.Expense.replace(/[^0-9.-]+/g, "")) : (parseFloat(row.Expense) || 0);
        amount = inc - exp;
    }
    // 4) Schwab: Withdrawal/Deposit
    else if (row.Withdrawal !== undefined || row.Deposit !== undefined) {
        const withdrawal = typeof row.Withdrawal === "string" ? parseFloat(row.Withdrawal.replace(/[^0-9.-]+/g, "")) : (parseFloat(row.Withdrawal) || 0);
        const deposit = typeof row.Deposit === "string" ? parseFloat(row.Deposit.replace(/[^0-9.-]+/g, "")) : (parseFloat(row.Deposit) || 0);
        amount = deposit - withdrawal;
    }

    // skip zero-amount rows (often headers/info)
    if (!amount) return null;

    return {
        Date: row.Date || row["Transaction Date"] || row["Post Date"] || "",
        Description: description,
        Amount: amount
    };
}

// ===========================
// File handling
// ===========================
function handleFile(file) {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();

    const processRows = (rows) => {
        // normalize rows
        const normalized = rows.map(normalizeRow).filter(Boolean);
        transactions = normalized.filter(r => Object.values(r).some(v => v !== null && v !== ""));
        txIndex = 0;

        // show table for reference (collapsed by default)
        renderTransactionsTable();

        // split into income vs expense
        const incomeTx = transactions.filter(r => r.Amount > 0);
        const expenseTx = transactions.filter(r => r.Amount <= 0);

        if (incomeTx.length > 0) {
            showIncomeModal(incomeTx, expenseTx);
        } else {
            // no income → go straight to expenses
            currentExpenses = expenseTx;
            transactions = currentExpenses;
            txIndex = 0;
            showExpenseModal();
        }

        // allow re-upload of the same file
        fileInput.value = "";
    };

    if (ext === "csv") {
        Papa.parse(file, { header: true, dynamicTyping: true, complete: (res) => processRows(res.data) });
    } else if (ext === "xlsx") {
        const reader = new FileReader();
        reader.onload = (e) => {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws);
            processRows(rows);
        };
        reader.readAsArrayBuffer(file);
    } else {
        alert("Please upload CSV or XLSX");
    }
}

// ===========================
// Income allocation modal
// ===========================
let currentIncome = [];
let currentExpenses = [];
let incomeTotal = 0;
let allocatedTotal = 0;

function renderIncomeList() {
    incomeListEl.innerHTML = "";
    incomeTotal = 0;

    currentIncome.forEach((tx, idx) => {
        const amt = parseFloat(tx.Amount) || 0;
        incomeTotal += amt;
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";
        li.innerHTML = `
      ${tx.Date} — ${tx.Description} — ${fmt(amt)}
      <button class="btn btn-sm btn-outline-danger" onclick="removeIncome(${idx})">−</button>
    `;
        incomeListEl.appendChild(li);
    });

    updateRemaining();
}

function updateRemaining() {
    allocatedTotal = envelopes.reduce((sum, env) => {
        const val = parseFloat(document.getElementById(`alloc_${env.id}`)?.value) || 0;
        return sum + val;
    }, 0);

    const remaining = incomeTotal - allocatedTotal;
    remainingIncomeEl.textContent = fmt(remaining);

    // Only negative if strictly less than 0
    if (remaining < 0) {
        remainingIncomeEl.classList.remove("text-success");
        remainingIncomeEl.classList.add("text-danger");
        negativeWarningEl.classList.remove("d-none");
    } else {
        remainingIncomeEl.classList.add("text-success");
        remainingIncomeEl.classList.remove("text-danger");
        negativeWarningEl.classList.add("d-none");
    }
}

function removeIncome(index) {
    // Move from income → expense (keeps user control)
    const removed = currentIncome.splice(index, 1)[0];
    currentExpenses.push(removed);
    renderIncomeList(); // update UI within same open modal
}

function showIncomeModal(incomeTx, expenseTx) {
    currentIncome = incomeTx;
    currentExpenses = expenseTx;

    // Build income list
    renderIncomeList();

    // Build allocation inputs for each envelope
    allocationFormEl.innerHTML = envelopes.map(env => `
    <div class="mb-2 d-flex align-items-center">
      <label class="me-2" style="width:140px;">${env.title}</label>
      <input type="number" class="form-control form-control-sm" id="alloc_${env.id}" placeholder="0.00" step="0.01"/>
    </div>
  `).join("");

    allocatedTotal = 0;
    updateRemaining();

    // Show income modal
    new bootstrap.Modal(incomeModalEl).show();
}

// Live recompute remaining when typing allocations
document.addEventListener("input", (e) => {
    if (e.target && e.target.id && e.target.id.startsWith("alloc_")) {
        updateRemaining();
    }
});

// Save allocations → fully close income modal → start expense modal
saveAllocationsBtn.addEventListener("click", () => {
    // apply allocations
    envelopes.forEach(env => {
        const val = parseFloat(document.getElementById(`alloc_${env.id}`)?.value) || 0;
        env.balance = (parseFloat(env.balance) || 0) + val;
    });
    saveEnvelopesForUser(currentUser, envelopes);
    renderEnvelopes();

    // prepare expenses list
    transactions = currentExpenses;
    txIndex = 0;

    // Close income modal and wait until fully hidden to avoid backdrop stacking
    const instance = bootstrap.Modal.getInstance(incomeModalEl);
    instance.hide();
    incomeModalEl.addEventListener("hidden.bs.modal", () => {
        if (transactions && transactions.length > 0) {
            showExpenseModal();
        } else {
            console.log("No expenses to process.");
        }
    }, { once: true });
});

// ===========================
// Expense categorization modal
// ===========================
function showExpenseModal() {
    // Finished all expenses?
    if (txIndex >= transactions.length) {
        expenseModal.hide();
        renderEnvelopes();
        return;
    }

    const tx = transactions[txIndex];
    const amt = parseFloat(tx.Amount) || 0;
    const merchant = normalizeMerchant(tx.Description || "");

    // Fill transaction line
    expenseTxInfo.textContent = `${tx.Date} — ${tx.Description} — ${fmt(amt)}`;

    // If we have memory, ask to repeat
    if (merchant && merchantMemory[merchant]) {
        const envId = merchantMemory[merchant];
        const env = envelopes.find(e => e.id === envId);
        if (env) {
            expenseEnvelopeButtons.innerHTML = `
        <div class="alert alert-info mb-3">
          Last time, you put "<strong>${tx.Description}</strong>" in <strong>${env.title}</strong>.<br/>
          Do you want to do the same again?
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-success" onclick="applyExpense('${env.id}', ${amt}, true)">Yes</button>
          <button class="btn btn-outline-primary" onclick="showEnvelopeButtons(${amt})">No, choose again</button>
        </div>
      `;
            if (!expenseModalEl.classList.contains("show")) expenseModal.show();
            return;
        }
    }

    // Otherwise render buttons
    showEnvelopeButtons(amt);
}

function showEnvelopeButtons(amt) {
    expenseEnvelopeButtons.innerHTML = envelopes.map(env => `
    <button class="btn btn-outline-primary" onclick="applyExpense('${env.id}', ${amt})">${env.title}</button>
  `).join("");

    if (!expenseModalEl.classList.contains("show")) expenseModal.show();
}

function applyExpense(envId, amt, auto = false) {
    const tx = transactions[txIndex];
    const env = envelopes.find(e => e.id === envId);
    if (env) {
        env.balance = (parseFloat(env.balance) || 0) + amt; // amt negative for expenses, positive for income if any slipped through
        saveEnvelopesForUser(currentUser, envelopes);
        renderEnvelopes();

        // remember merchant mapping
        const merchant = normalizeMerchant(tx.Description || "");
        if (merchant) {
            merchantMemory[merchant] = env.id;
            saveMerchantMemory();
        }
    }

    txIndex++;
    showExpenseModal(); // update same open modal, no re-open
}

skipExpenseBtn.addEventListener("click", () => {
    txIndex++;
    showExpenseModal();
});

// ===========================
// Auth
// ===========================
function login() {
    const u = usernameInput.value.trim();
    const p = passwordInput.value.trim();
    if (!u || !p) return alert("Enter username & password");

    currentUser = u;
    localStorage.setItem("currentUser", currentUser);
    envelopes = loadEnvelopesForUser(currentUser);

    authSection.classList.add("d-none");
    appSection.classList.remove("d-none");
    welcomeText.textContent = `Welcome, ${currentUser}`;
    renderEnvelopes();
}

function logout() {
    localStorage.removeItem("currentUser");
    currentUser = null;
    envelopes = [];
    appSection.classList.add("d-none");
    authSection.classList.remove("d-none");

    // Clear UI
    envelopeList.innerHTML = "";
    transactionsTableWrapper.innerHTML = "";
    transactionsSection.classList.add("d-none");

    usernameInput.value = "";
    passwordInput.value = "";
}

function deleteUser() {
    if (!currentUser) return;

    deleteUserMessage.textContent = `Are you sure you want to permanently delete user "${currentUser}" and all their envelopes?`;
    new bootstrap.Modal(deleteUserModalEl).show();
}

confirmDeleteUserBtn.addEventListener("click", () => {
    if (!currentUser) return;
    localStorage.removeItem(`envelopes_${currentUser}`);
    localStorage.removeItem("currentUser");
    currentUser = null;
    envelopes = [];

    // Reset UI
    appSection.classList.add("d-none");
    authSection.classList.remove("d-none");
    envelopeList.innerHTML = "";
    transactionsTableWrapper.innerHTML = "";
    transactionsSection.classList.add("d-none");
    usernameInput.value = "";
    passwordInput.value = "";

    bootstrap.Modal.getInstance(deleteUserModalEl).hide();
});

// ===========================
// Events
// ===========================
loginBtn.addEventListener("click", login);
logoutBtn.addEventListener("click", logout);
deleteUserBtn.addEventListener("click", deleteUser);

showNewEnvelopeBtn.addEventListener("click", () => toggleNewEnvelopeForm(true));
cancelEnvelopeBtn.addEventListener("click", () => toggleNewEnvelopeForm(false));
createEnvelopeBtn.addEventListener("click", createEnvelope);

fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

// Auto-login if a user was stored
document.addEventListener("DOMContentLoaded", () => {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
        currentUser = savedUser;
        envelopes = loadEnvelopesForUser(currentUser);
        authSection.classList.add("d-none");
        appSection.classList.remove("d-none");
        welcomeText.textContent = `Welcome back, ${currentUser}`;
        renderEnvelopes();
    }
});
