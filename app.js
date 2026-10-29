// ==========================================
// RIFT METRO HARDWARE - SYSTEM CONTROLLER
// ==========================================
const SUPABASE_URL = 'https://htfmtwrbqrytjfnsulow.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_apSmCIhXSUOENc9lRbDoJA_-hg0EQK3';

let _supabase = null;
try {
    if (window.supabase) {
        _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.warn("Supabase init failed. Operating with resilient local fallback.");
}

// Built-in starter products matching the poster
const DEFAULT_INVENTORY = [
    { sku: "CEM-001", name: "Simba Cement 50kg", category: "Cement", price: 850, cost_price: 750, min_price: 820, quantity: 150, threshold: 30, unit: "bag" },
    { sku: "STL-012", name: "D12 High-Yield Steel Bars", category: "Steel Bars", price: 1650, cost_price: 1450, min_price: 1580, quantity: 95, threshold: 25, unit: "pcs" },
    { sku: "PLM-004", name: "PPR Water Pipes (32mm)", category: "Plumbing", price: 620, cost_price: 500, min_price: 580, quantity: 45, threshold: 10, unit: "pcs" },
    { sku: "PNT-002", name: "Crown Weather Shield 20L", category: "Paint", price: 8900, cost_price: 7800, min_price: 8500, quantity: 18, threshold: 5, unit: "tins" },
    { sku: "MBT-001", name: "Box Profile Mabati (30G)", category: "Mabati", price: 950, cost_price: 820, min_price: 900, quantity: 120, threshold: 40, unit: "meters" }
];

const DEFAULT_STAFF = [
    { username: "admin", pin: "1234", role: "admin", full_name: "Store Manager" },
    { username: "operator1", pin: "1111", role: "operator", full_name: "Desk Cashier" }
];

// App Memory State
let inventory = [];
let staff = [];
let sales = [];
let expenses = [];
let inquiries = [];
let cart = [];
let currentUser = null; 
let pendingLoginRole = null;

// ==========================================
// 1. BOOTSTRAPPER
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Load Local Storage Caches
    inventory = JSON.parse(localStorage.getItem("rm_inventory")) || DEFAULT_INVENTORY;
    staff = JSON.parse(localStorage.getItem("rm_staff")) || DEFAULT_STAFF;
    sales = JSON.parse(localStorage.getItem("rm_sales")) || [];
    expenses = JSON.parse(localStorage.getItem("rm_expenses")) || [];
    inquiries = JSON.parse(localStorage.getItem("rm_inquiries")) || [];

    // 2. Fetch from Supabase if online
    await syncAllFromCloud();

    // 3. Render Initial View
    renderCatalogGrid();
    renderCartList();
});

async function syncAllFromCloud() {
    if (!_supabase || !navigator.onLine) return;
    try {
        const { data: inv } = await _supabase.from("hardware_inventory").select("*");
        if (inv && inv.length > 0) {
            inventory = inv;
            localStorage.setItem("rm_inventory", JSON.stringify(inventory));
        }

        const { data: stf } = await _supabase.from("staff_users").select("*");
        if (stf && stf.length > 0) {
            staff = stf;
            localStorage.setItem("rm_staff", JSON.stringify(staff));
        }

        const { data: sls } = await _supabase.from("sales_reports").select("*").order("created_at", { ascending: false });
        if (sls) {
            sales = sls;
            localStorage.setItem("rm_sales", JSON.stringify(sales));
        }

        const { data: exp } = await _supabase.from("shop_expenses").select("*").order("created_at", { ascending: false });
        if (exp) {
            expenses = exp;
            localStorage.setItem("rm_expenses", JSON.stringify(expenses));
        }
    } catch (e) {
        console.warn("Cloud sync deferred:", e);
    }
}

// ==========================================
// 2. NAVIGATION & LOGIN HANDLERS (GUARANTEED WORKING)
// ==========================================
function navigateToView(targetView) {
    // If public catalog, let anyone view
    if (targetView === "viewer") {
        displaySection("viewViewer");
        setActiveNavButton("btnRoleViewer");
        document.getElementById("catalogSearchStrip").style.display = "flex";
        renderCatalogGrid();
        return;
    }

    // If Operator or Admin is requested, verify login session
    if (currentUser) {
        if (targetView === "operator") {
            displaySection("viewOperator");
            setActiveNavButton("btnRoleOperator");
            document.getElementById("catalogSearchStrip").style.display = "none";
            initOperatorDesk();
            return;
        }
        if (targetView === "admin") {
            if (currentUser.role === "admin") {
                displaySection("viewAdmin");
                setActiveNavButton("btnRoleAdmin");
                document.getElementById("catalogSearchStrip").style.display = "none";
                initAdminPortal();
                return;
            } else {
                alert("Permission Denied: Administrator clearance required.");
                return;
            }
        }
    }

    // If not logged in, show Login Screen
    pendingLoginRole = targetView;
    displaySection("viewLogin");
    setActiveNavButton(targetView === "admin" ? "btnRoleAdmin" : "btnRoleOperator");
    document.getElementById("catalogSearchStrip").style.display = "none";
    document.getElementById("loginTitle").textContent = targetView === "admin" ? "Admin Security Terminal" : "Operator Desk Terminal";
    document.getElementById("txtLoginUser").value = "";
    document.getElementById("txtLoginPin").value = "";
}

function displaySection(viewId) {
    document.querySelectorAll(".section-view").forEach(sec => sec.classList.remove("active"));
    const activeSec = document.getElementById(viewId);
    if (activeSec) activeSec.classList.add("active");
}

function setActiveNavButton(btnId) {
    document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.getElementById(btnId);
    if (activeBtn) activeBtn.classList.add("active");
}

function submitStaffLogin() {
    const username = document.getElementById("txtLoginUser").value.trim().toLowerCase();
    const pin = document.getElementById("txtLoginPin").value.trim();

    const user = staff.find(u => u.username.toLowerCase() === username && u.pin === pin);

    if (!user) {
        alert("Invalid staff username or security PIN. Default is admin / 1234");
        return;
    }

    if (pendingLoginRole === "admin" && user.role !== "admin") {
        alert("Access Denied: You do not have Administrator permissions.");
        return;
    }

    currentUser = user;
    document.getElementById("activeUserGreeting").textContent = `${user.full_name} (${user.role.toUpperCase()})`;
    document.getElementById("btnLogout").style.display = "inline-flex";

    navigateToView(user.role === "admin" ? "admin" : "operator");
}

function logoutCurrentSession() {
    currentUser = null;
    document.getElementById("activeUserGreeting").textContent = "Customer View";
    document.getElementById("btnLogout").style.display = "none";
    navigateToView("viewer");
}

// ==========================================
// 3. CATALOG & WHATSAPP BASKET
// ==========================================
function renderCatalogGrid() {
    const grid = document.getElementById("productsCatalogGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const query = (document.getElementById("catalogSearchInput")?.value || "").toLowerCase();
    const category = document.getElementById("catalogCategorySelect")?.value || "All";

    const filtered = inventory.filter(item => {
        const matchesQuery = item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query);
        const matchesCategory = (category === "All" || item.category === category);
        return matchesQuery && matchesCategory;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding:30px;">No hardware materials found matching your search.</p>`;
        return;
    }

    filtered.forEach(item => {
        const isLow = item.quantity <= item.threshold;
        grid.innerHTML += `
            <div class="product-card">
                <div>
                    <div class="card-top">
                        <span class="sku-tag">${item.sku}</span>
                        <span class="stock-pill ${isLow ? 'low-stock' : 'in-stock'}">${isLow ? 'Low Stock' : 'In Stock'}</span>
                    </div>
                    <h4>${item.name}</h4>
                    <div class="category-subtitle">${item.category}</div>
                </div>
                <div>
                    <div class="price-row">KES ${item.price.toLocaleString()} <small>/ ${item.unit}</small></div>
                    <button type="button" class="btn-primary" onclick="addToOrderCart('${item.sku}')">+ Add to Order</button>
                </div>
            </div>
        `;
    });
}

function handleCatalogFilter() {
    renderCatalogGrid();
}

function addToOrderCart(sku) {
    const item = inventory.find(p => p.sku === sku);
    if (!item) return;

    const existing = cart.find(c => c.sku === sku);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ sku: item.sku, name: item.name, price: item.price, unit: item.unit, qty: 1 });
    }
    renderCartList();
}

function removeFromOrderCart(index) {
    cart.splice(index, 1);
    renderCartList();
}

function renderCartList() {
    const container = document.getElementById("cartItemsContainer");
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem; text-align:center;">Your order list is empty. Click "+ Add to Order" on any material.</p>`;
        document.getElementById("lblCartSubtotal").textContent = "KES 0.00";
        document.getElementById("lblCartTax").textContent = "KES 0.00";
        document.getElementById("lblCartGrandTotal").textContent = "KES 0.00";
        return;
    }

    container.innerHTML = "";
    let subtotal = 0;

    cart.forEach((c, idx) => {
        const lineTotal = c.price * c.qty;
        subtotal += lineTotal;
        container.innerHTML += `
            <div class="cart-line-item">
                <div>
                    <strong>${c.name}</strong><br>
                    <small>KES ${c.price} × ${c.qty} ${c.unit}</small>
                </div>
                <div>
                    <span>KES ${lineTotal.toLocaleString()}</span>
                    <button type="button" onclick="removeFromOrderCart(${idx})" style="background:none; border:none; color:red; cursor:pointer; font-weight:bold; margin-left:8px;">✕</button>
                </div>
            </div>
        `;
    });

    const tax = subtotal * 0.16;
    const grand = subtotal + tax;

    document.getElementById("lblCartSubtotal").textContent = `KES ${subtotal.toLocaleString()}`;
    document.getElementById("lblCartTax").textContent = `KES ${tax.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    document.getElementById("lblCartGrandTotal").textContent = `KES ${grand.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

async function dispatchWhatsAppOrder() {
    if (cart.length === 0) {
        alert("Your order inquiry list is empty.");
        return;
    }

    let summary = "";
    let subtotal = 0;
    let message = "Hello Rift Metro Hardware, I would like to order the following materials:\n\n";

    cart.forEach((item, idx) => {
        const line = item.price * item.qty;
        subtotal += line;
        summary += `${item.name} (${item.qty} ${item.unit}), `;
        message += `${idx + 1}. ${item.name} - ${item.qty} ${item.unit} @ KES ${item.price} = KES ${line.toLocaleString()}\n`;
    });

    const tax = subtotal * 0.16;
    const grand = subtotal + tax;

    message += `\nSubtotal: KES ${subtotal.toLocaleString()}`;
    message += `\nVAT (16%): KES ${tax.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    message += `\n*Estimated Total: KES ${grand.toLocaleString(undefined, {minimumFractionDigits:2})}*`;
    message += `\n\nPayment via Paybill: 880100 (A/C: 117761)\nPlease confirm availability and delivery terms.`;

    // Log Inquiry
    const newInquiry = { order_summary: summary, total_estimated: grand, created_at: new Date().toISOString() };
    inquiries.unshift(newInquiry);
    localStorage.setItem("rm_inquiries", JSON.stringify(inquiries));
    if (_supabase) _supabase.from("customer_inquiries").insert([newInquiry]).then(() => {});

    window.open(`https://wa.me/254716117761?text=${encodeURIComponent(message)}`, "_blank");
}

// ==========================================
// 4. OPERATOR POINT OF SALE
// ==========================================
function initOperatorDesk() {
    document.getElementById("posCashierName").value = currentUser ? currentUser.full_name : "Cashier";
    populatePosItemsSelect();
    renderOperatorLowStock();
    renderOperatorInquiries();
}

function populatePosItemsSelect() {
    const sel = document.getElementById("posItemSelect");
    if (!sel) return;
    sel.innerHTML = "";
    inventory.forEach(p => {
        sel.innerHTML += `<option value="${p.sku}">${p.name} (Stock: ${p.quantity} ${p.unit})</option>`;
    });
    handlePosItemChange();
}

function handlePosItemChange() {
    const sku = document.getElementById("posItemSelect").value;
    const item = inventory.find(p => p.sku === sku);
    if (!item) return;

    document.getElementById("posItemNotice").textContent = `Available Stock: ${item.quantity} ${item.unit} | Floor Price Limit: KES ${item.min_price}`;
    document.getElementById("posAgreedPriceInput").value = item.price;
    calculatePosNumbers();
}

function calculatePosNumbers() {
    const sku = document.getElementById("posItemSelect").value;
    const item = inventory.find(p => p.sku === sku);
    const qty = parseInt(document.getElementById("posQuantityInput").value) || 0;
    const price = parseFloat(document.getElementById("posAgreedPriceInput").value) || 0;

    const alertBox = document.getElementById("posPriceFloorAlert");
    if (item && price < item.min_price) {
        alertBox.textContent = `⚠️ Below allowable floor price (KES ${item.min_price})!`;
    } else {
        alertBox.textContent = "";
    }

    const subtotal = qty * price;
    const vat = subtotal * 0.16;
    const grand = subtotal + vat;

    document.getElementById("lblPosSubtotal").textContent = `KES ${subtotal.toLocaleString()}`;
    document.getElementById("lblPosVat").textContent = `KES ${vat.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    document.getElementById("lblPosPayable").textContent = `KES ${grand.toLocaleString(undefined, {minimumFractionDigits:2})}`;
}

async function finalizeCashierSale() {
    const sku = document.getElementById("posItemSelect").value;
    const item = inventory.find(p => p.sku === sku);
    const qty = parseInt(document.getElementById("posQuantityInput").value) || 0;
    const price = parseFloat(document.getElementById("posAgreedPriceInput").value) || 0;
    const mode = document.getElementById("posPaymentMode").value;

    if (!item || qty <= 0) {
        alert("Please select a valid item and quantity.");
        return;
    }

    if (qty > item.quantity) {
        alert(`Insufficient Stock! Only ${item.quantity} ${item.unit} available.`);
        return;
    }

    const subtotal = qty * price;
    const vat = subtotal * 0.16;
    const total = subtotal + vat;

    // Deduct stock
    item.quantity -= qty;
    localStorage.setItem("rm_inventory", JSON.stringify(inventory));

    // Save Sale Log
    const saleRecord = {
        operator_name: currentUser.full_name,
        item_name: item.name,
        sku: item.sku,
        category: item.category,
        quantity_sold: qty,
        unit_price: price,
        total_paid: total,
        tax_applied: vat,
        payment_mode: mode,
        created_at: new Date().toISOString()
    };
    sales.unshift(saleRecord);
    localStorage.setItem("rm_sales", JSON.stringify(sales));

    // Cloud Sync
    if (_supabase) {
        _supabase.from("hardware_inventory").update({ quantity: item.quantity }).eq("sku", sku).then(() => {});
        _supabase.from("sales_reports").insert([saleRecord]).then(() => {});
    }

    alert("Sale successfully completed! Displaying receipt...");
    initOperatorDesk();

    // Show Printable Thermal Receipt
    showThermalReceipt({
        cashier: currentUser.full_name,
        item: item.name,
        qty: qty,
        unit: item.unit,
        price: price,
        subtotal: subtotal,
        tax: vat,
        total: total,
        mode: mode,
        date: new Date().toLocaleString()
    });
}

function showThermalReceipt(data) {
    const box = document.getElementById("receiptDetailsBody");
    box.innerHTML = `
        <div style="margin-bottom:6px;">Date: ${data.date}</div>
        <div style="margin-bottom:6px;">Cashier: ${data.cashier}</div>
        <div style="margin-bottom:8px;">Payment: ${data.mode} ${data.mode === 'M-PESA' ? '(Paybill: 880100)' : ''}</div>
        <div style="border-top:1px dashed #000; border-bottom:1px dashed #000; padding:8px 0; margin:8px 0;">
            <div><strong>${data.item}</strong></div>
            <div>${data.qty} ${data.unit} × KES ${data.price.toLocaleString()}</div>
            <div style="display:flex; justify-content:space-between; margin-top:4px;">
                <span>Subtotal:</span> <strong>KES ${data.subtotal.toLocaleString()}</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
                <span>VAT (16%):</span> <strong>KES ${data.tax.toLocaleString(undefined, {minimumFractionDigits:2})}</strong>
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:1.05rem; font-weight:800;">
            <span>TOTAL:</span> <span>KES ${data.total.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
        </div>
    `;
    document.getElementById("receiptModalBox").style.display = "flex";
}

function renderOperatorLowStock() {
    const box = document.getElementById("operatorLowStockList");
    if (!box) return;
    box.innerHTML = "";
    const low = inventory.filter(p => p.quantity <= p.threshold);
    if (low.length === 0) {
        box.innerHTML = `<p style="color:#059669; font-size:0.85rem;">All materials above threshold.</p>`;
        return;
    }
    low.forEach(item => {
        box.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--border-color); font-size:0.85rem;">
                <span>${item.name}</span>
                <strong style="color:var(--crimson-red);">${item.quantity} ${item.unit} left</strong>
            </div>
        `;
    });
}

function renderOperatorInquiries() {
    const box = document.getElementById("operatorInquiryLog");
    if (!box) return;
    box.innerHTML = "";
    if (inquiries.length === 0) {
        box.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">No recent inquiries.</p>`;
        return;
    }
    inquiries.slice(0, 5).forEach(inq => {
        box.innerHTML += `
            <div style="padding:6px 0; border-bottom:1px solid var(--border-color); font-size:0.85rem;">
                <div>${inq.order_summary}</div>
                <strong style="color:var(--brand-blue);">Est: KES ${inq.total_estimated.toLocaleString()}</strong>
            </div>
        `;
    });
}

// ==========================================
// 5. ADMIN PORTAL & REPORTS
// ==========================================
function initAdminPortal() {
    showAdminTab("stock");
    renderAdminStockTable();
    renderAdminReports();
    renderExpenseTable();
    renderStaffTable();
}

function showAdminTab(tabName) {
    document.querySelectorAll(".admin-subtab").forEach(tab => tab.style.display = "none");
    document.querySelectorAll(".admin-subtab-btn").forEach(btn => btn.classList.remove("active"));

    if (tabName === "stock") document.getElementById("adminTabStock").style.display = "block";
    if (tabName === "reports") {
        document.getElementById("adminTabReports").style.display = "block";
        renderAdminReports();
    }
    if (tabName === "expenses") document.getElementById("adminTabExpenses").style.display = "block";
    if (tabName === "staff") document.getElementById("adminTabStaff").style.display = "block";
}

async function adminCommitStock() {
    const name = document.getElementById("admItemName").value.trim();
    const sku = document.getElementById("admSku").value.trim().toUpperCase();
    const category = document.getElementById("admCategory").value;
    const price = parseFloat(document.getElementById("admSellingPrice").value);
    const cost = parseFloat(document.getElementById("admCostPrice").value) || 0;
    const floor = parseFloat(document.getElementById("admFloorPrice").value) || price;
    const qty = parseInt(document.getElementById("admQuantity").value) || 0;
    const threshold = parseInt(document.getElementById("admThreshold").value) || 10;
    const unit = document.getElementById("admUnit").value.trim() || "pcs";

    if (!name || !sku || isNaN(price)) {
        alert("Please enter Name, SKU, and Selling Price.");
        return;
    }

    const newItem = { sku, name, category, price, cost_price: cost, min_price: floor, quantity: qty, threshold, unit };
    const existingIndex = inventory.findIndex(p => p.sku === sku);

    if (existingIndex >= 0) {
        inventory[existingIndex] = newItem;
    } else {
        inventory.push(newItem);
    }

    localStorage.setItem("rm_inventory", JSON.stringify(inventory));
    if (_supabase) _supabase.from("hardware_inventory").upsert([newItem]).then(() => {});

    alert("Stock saved successfully!");
    renderAdminStockTable();
}

function renderAdminStockTable() {
    const tbody = document.getElementById("tblAdminStockBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    inventory.forEach(item => {
        const isLow = item.quantity <= item.threshold;
        tbody.innerHTML += `
            <tr>
                <td><code>${item.sku}</code></td>
                <td><strong>${item.name}</strong></td>
                <td>${item.category}</td>
                <td>KES ${item.price.toLocaleString()}</td>
                <td>KES ${item.cost_price.toLocaleString()}</td>
                <td><strong>${item.quantity} ${item.unit}</strong></td>
                <td>${item.threshold}</td>
                <td><span class="stock-pill ${isLow ? 'low-stock' : 'in-stock'}">${isLow ? 'Low Stock' : 'Stable'}</span></td>
            </tr>
        `;
    });
}

function renderAdminReports() {
    const categoryFilter = document.getElementById("filterReportCategory")?.value || "All";
    const start = document.getElementById("filterReportStart")?.value;
    const end = document.getElementById("filterReportEnd")?.value;

    const filtered = sales.filter(s => {
        let matchCat = (categoryFilter === "All" || s.category === categoryFilter);
        let sDate = new Date(s.created_at);
        let matchDate = true;
        if (start && sDate < new Date(start)) matchDate = false;
        if (end && sDate > new Date(end + "T23:59:59")) matchDate = false;
        return matchCat && matchDate;
    });

    const tbody = document.getElementById("tblSalesReportBody");
    if (tbody) {
        tbody.innerHTML = "";
        filtered.forEach(s => {
            tbody.innerHTML += `
                <tr>
                    <td>${new Date(s.created_at).toLocaleDateString()}</td>
                    <td>${s.operator_name}</td>
                    <td>${s.item_name}</td>
                    <td>${s.category}</td>
                    <td>${s.quantity_sold}</td>
                    <td>${s.payment_mode}</td>
                    <td><strong>KES ${s.total_paid.toLocaleString()}</strong></td>
                </tr>
            `;
        });
    }

    // Profit & Loss calculation
    const grossRev = filtered.reduce((acc, curr) => acc + curr.total_paid, 0);
    const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const netProfit = grossRev - totalExpenses;

    document.getElementById("kpiGrossRev").textContent = `KES ${grossRev.toLocaleString()}`;
    document.getElementById("kpiExpenses").textContent = `KES ${totalExpenses.toLocaleString()}`;
    document.getElementById("kpiNetProfit").textContent = `KES ${netProfit.toLocaleString()}`;
}

async function recordStoreExpense() {
    const category = document.getElementById("expCategory").value;
    const amount = parseFloat(document.getElementById("expAmount").value);
    const remarks = document.getElementById("expNotes").value.trim();

    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid expense amount.");
        return;
    }

    const newExp = {
        expense_type: category,
        amount: amount,
        description: remarks,
        recorded_by: currentUser.full_name,
        created_at: new Date().toISOString()
    };

    expenses.unshift(newExp);
    localStorage.setItem("rm_expenses", JSON.stringify(expenses));
    if (_supabase) _supabase.from("shop_expenses").insert([newExp]).then(() => {});

    alert("Expense committed to ledger!");
    document.getElementById("expAmount").value = "";
    document.getElementById("expNotes").value = "";
    renderExpenseTable();
    renderAdminReports();
}

function renderExpenseTable() {
    const tbody = document.getElementById("tblExpenseBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    expenses.forEach(e => {
        tbody.innerHTML += `
            <tr>
                <td>${new Date(e.created_at).toLocaleDateString()}</td>
                <td><strong>${e.expense_type}</strong></td>
                <td>KES ${e.amount.toLocaleString()}</td>
                <td>${e.description || '-'}</td>
                <td>${e.recorded_by}</td>
            </tr>
        `;
    });
}

async function adminSaveStaffUser() {
    const username = document.getElementById("newStaffUser").value.trim().toLowerCase();
    const full_name = document.getElementById("newStaffName").value.trim();
    const pin = document.getElementById("newStaffPin").value.trim();
    const role = document.getElementById("newStaffRole").value;

    if (!username || !full_name || !pin) {
        alert("Please fill in Username, Name, and PIN.");
        return;
    }

    const newStaff = { username, full_name, pin, role };
    const existingIndex = staff.findIndex(s => s.username === username);

    if (existingIndex >= 0) {
        staff[existingIndex] = newStaff;
    } else {
        staff.push(newStaff);
    }

    localStorage.setItem("rm_staff", JSON.stringify(staff));
    if (_supabase) _supabase.from("staff_users").upsert([newStaff]).then(() => {});

    alert("Staff record updated!");
    renderStaffTable();
}

function renderStaffTable() {
    const tbody = document.getElementById("tblStaffBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    staff.forEach(s => {
        tbody.innerHTML += `
            <tr>
                <td><code>${s.username}</code></td>
                <td>${s.full_name}</td>
                <td><strong>${s.role.toUpperCase()}</strong></td>
            </tr>
        `;
    });
}

function exportSalesReportCsv() {
    let csv = "Date,Cashier,Item,Category,Quantity,PaymentMode,TotalPaid\n";
    sales.forEach(s => {
        csv += `"${s.created_at}","${s.operator_name}","${s.item_name}","${s.category}",${s.quantity_sold},"${s.payment_mode}",${s.total_paid}\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
    link.download = "rift_metro_sales_report.csv";
    link.click();
}
