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
    console.warn("Supabase init failed. Operating with local fallback.");
}

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

let inventory = [];
let staff = [];
let sales = [];
let expenses = [];
let inquiries = [];
let cart = [];
let currentUser = null; 
let pendingLoginRole = null;

document.addEventListener("DOMContentLoaded", async () => {
    inventory = JSON.parse(localStorage.getItem("rm_inventory")) || DEFAULT_INVENTORY;
    staff = JSON.parse(localStorage.getItem("rm_staff")) || DEFAULT_STAFF;
    sales = JSON.parse(localStorage.getItem("rm_sales")) || [];
    expenses = JSON.parse(localStorage.getItem("rm_expenses")) || [];
    inquiries = JSON.parse(localStorage.getItem("rm_inquiries")) || [];

    await syncAllFromCloud();
    renderViewerCatalog();
    renderOrderCart();
});

async function syncAllFromCloud() {
    if (!_supabase || !navigator.onLine) return;
    try {
        const { data: inv } = await _supabase.from("hardware_inventory").select("*");
        if (inv && inv.length > 0) { inventory = inv; localStorage.setItem("rm_inventory", JSON.stringify(inventory)); }
        const { data: stf } = await _supabase.from("staff_users").select("*");
        if (stf && stf.length > 0) { staff = stf; localStorage.setItem("rm_staff", JSON.stringify(staff)); }
        const { data: sls } = await _supabase.from("sales_reports").select("*").order("created_at", { ascending: false });
        if (sls) { sales = sls; localStorage.setItem("rm_sales", JSON.stringify(sales)); }
        const { data: exp } = await _supabase.from("shop_expenses").select("*").order("created_at", { ascending: false });
        if (exp) { expenses = exp; localStorage.setItem("rm_expenses", JSON.stringify(expenses)); }
    } catch (e) {
        console.warn("Cloud sync deferred:", e);
    }
}

// NAVIGATION ROUTING
function handleNavClick(role) {
    if (role === 'viewer') {
        switchRole('viewer');
        return;
    }
    if (currentUser && ((role === 'operator' && (currentUser.role === 'operator' || currentUser.role === 'admin')) || (role === 'admin' && currentUser.role === 'admin'))) {
        switchRole(role);
    } else {
        promptLogin(role);
    }
}

function promptLogin(role) {
    document.querySelectorAll(".app-view").forEach(v => v.classList.remove("active"));
    document.getElementById("view-login").classList.add("active");
    document.getElementById("searchBarSection").style.display = "none";
    document.getElementById("loginRolePrompt").textContent = `Enter credentials for ${role.toUpperCase()} terminal`;
    document.getElementById("loginUser").dataset.targetRole = role;
    document.getElementById("loginUser").value = "";
    document.getElementById("loginPin").value = "";
}

function cancelLogin() {
    if (currentUser) {
        switchRole(currentUser.role === 'admin' ? 'admin' : 'operator');
    } else {
        switchRole('viewer');
    }
}

async function executeLogin() {
    const user = document.getElementById("loginUser").value.trim().toLowerCase();
    const pin = document.getElementById("loginPin").value.trim();
    const targetRole = document.getElementById("loginUser").dataset.targetRole;

    const staffMember = staff.find(u => u.username.toLowerCase() === user && u.pin === pin);
    if (!staffMember) {
        alert("Invalid Username or Security PIN.");
        return;
    }
    if (targetRole === 'admin' && staffMember.role !== 'admin') {
        alert("Access Denied: Requires Administrator privileges.");
        return;
    }

    currentUser = staffMember;
    document.getElementById("current-user-display").textContent = `User: ${staffMember.full_name} (${staffMember.role.toUpperCase()})`;
    document.getElementById("btn-logout").style.display = "inline-block";

    switchRole(staffMember.role === 'admin' ? 'admin' : 'operator');
}

function logoutSession() {
    currentUser = null;
    document.getElementById("current-user-display").textContent = "Mode: Customer";
    document.getElementById("btn-logout").style.display = "none";
    switchRole("viewer");
}

function switchRole(role) {
    document.querySelectorAll(".app-view").forEach(v => v.classList.remove("active"));
    document.querySelectorAll(".role-btn").forEach(b => b.classList.remove("active"));

    if (role === 'viewer') {
        document.getElementById("view-viewer").classList.add("active");
        document.getElementById("btn-viewer").classList.add("active");
        document.getElementById("searchBarSection").style.display = "flex";
        renderViewerCatalog();
    } else {
        document.getElementById("searchBarSection").style.display = "none";
        if (role === 'operator') {
            document.getElementById("view-operator").classList.add("active");
            document.getElementById("btn-operator").classList.add("active");
            document.getElementById("opActiveName").value = currentUser ? currentUser.full_name : 'Cashier';
            populateOperatorDropdown();
            renderOperatorLowStock();
            renderOperatorInquiries();
        } else if (role === 'admin') {
            document.getElementById("view-admin").classList.add("active");
            document.getElementById("btn-admin").classList.add("active");
            renderAdminStockTable();
            renderReportsTables();
            renderExpensesTable();
            renderStaffTable();
            populateReportOperatorDropdown();
        }
    }
}

function triggerPasswordReset() {
    alert("To reset the admin password, execute in Supabase SQL Editor:\nUPDATE staff_users SET pin = 'NEW_PIN' WHERE username = 'admin';");
}

// CATALOG & CART
function renderViewerCatalog() {
    const grid = document.getElementById("productGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const query = (document.getElementById("searchInput")?.value || "").toLowerCase();
    const cat = document.getElementById("categoryFilter")?.value || "All";

    const filtered = inventory.filter(p => {
        const matchesQuery = p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query);
        const matchesCat = (cat === "All" || p.category === cat);
        return matchesQuery && matchesCat;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:30px;">No hardware items found.</p>`;
        return;
    }

    filtered.forEach(item => {
        const isLow = item.quantity <= item.threshold;
        grid.innerHTML += `
            <div class="product-card">
                <div>
                    <div class="card-header">
                        <span class="sku-badge">${item.sku}</span>
                        <span class="badge ${isLow ? 'low' : 'ok'}">${isLow ? 'Low Stock' : 'In Stock'}</span>
                    </div>
                    <h4>${item.name}</h4>
                    <p class="category-text">${item.category}</p>
                </div>
                <div>
                    <div class="price-box">KES ${item.price.toLocaleString()} <small>/ ${item.unit}</small></div>
                    <button class="action-btn" onclick="addToOrderCart('${item.sku}')">+ Add to Order</button>
                </div>
            </div>
        `;
    });
}

function filterCatalog() { renderViewerCatalog(); }

function addToOrderCart(sku) {
    const item = inventory.find(p => p.sku === sku);
    if (!item) return;
    const existing = cart.find(c => c.sku === sku);
    if (existing) existing.qty += 1;
    else cart.push({ sku: item.sku, name: item.name, price: item.price, unit: item.unit, qty: 1 });
    renderOrderCart();
}

function removeFromCart(idx) { cart.splice(idx, 1); renderOrderCart(); }

function renderOrderCart() {
    const container = document.getElementById("cartItems");
    if (!container) return;
    if (cart.length === 0) {
        container.innerHTML = `<p class="empty-cart">Your list is empty. Add items to order via WhatsApp.</p>`;
        document.getElementById("cartSubtotal").textContent = "KES 0.00";
        document.getElementById("cartVat").textContent = "KES 0.00";
        document.getElementById("cartTotal").textContent = "KES 0.00";
        return;
    }

    container.innerHTML = "";
    let subtotal = 0;
    cart.forEach((c, idx) => {
        let line = c.price * c.qty;
        subtotal += line;
        container.innerHTML += `
            <div class="cart-item-row">
                <div><strong>${c.name}</strong><br><small>KES ${c.price} × ${c.qty} ${c.unit}</small></div>
                <div><span>KES ${line.toLocaleString()}</span><button onclick="removeFromCart(${idx})" class="remove-btn">✕</button></div>
            </div>
        `;
    });

    let vat = subtotal * 0.16;
    let grand = subtotal + vat;
    document.getElementById("cartSubtotal").textContent = `KES ${subtotal.toLocaleString()}`;
    document.getElementById("cartVat").textContent = `KES ${vat.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    document.getElementById("cartTotal").textContent = `KES ${grand.toLocaleString(undefined, {minimumFractionDigits:2})}`;
}

async function sendWhatsAppOrder() {
    if (cart.length === 0) return alert("Cart is empty.");
    let summary = "";
    let subtotal = 0;
    cart.forEach(i => { subtotal += (i.price * i.qty); summary += `${i.name} (${i.qty} ${i.unit}), `; });
    let total = subtotal * 1.16;

    const inq = { order_summary: summary, total_estimated: total, created_at: new Date().toISOString() };
    inquiries.unshift(inq);
    localStorage.setItem("rm_inquiries", JSON.stringify(inquiries));
    if (_supabase) _supabase.from("customer_inquiries").insert([inq]).then(() => {});

    let message = `Hello Rift Metro Hardware, I would like to order:\n`;
    cart.forEach((i, idx) => message += `${idx+1}. ${i.name} - ${i.qty} ${i.unit} @ KES ${i.price}\n`);
    message += `\nEstimated Total (Incl. 16% VAT): KES ${total.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    message += `\nPaybill: 880100 (A/C: 117761)`;

    window.open(`https://wa.me/254716117761?text=${encodeURIComponent(message)}`, "_blank");
}

// OPERATOR POS
function populateOperatorDropdown() {
    const sel = document.getElementById("posItemSelect");
    if (!sel) return;
    sel.innerHTML = "";
    inventory.forEach(p => {
        sel.innerHTML += `<option value="${p.sku}">${p.name} (Stock: ${p.quantity} ${p.unit})</option>`;
    });
    updatePosItemDetails();
}

function updatePosItemDetails() {
    const sku = document.getElementById("posItemSelect").value;
    const item = inventory.find(p => p.sku === sku);
    if (!item) return;
    document.getElementById("posInventoryHint").textContent = `Stock: ${item.quantity} ${item.unit} | Floor Price: KES ${item.min_price}`;
    document.getElementById("posPriceInput").value = item.price;
    calculatePosTotal();
}

function calculatePosTotal() {
    const sku = document.getElementById("posItemSelect").value;
    const item = inventory.find(p => p.sku === sku);
    const qty = parseInt(document.getElementById("posQtyInput").value) || 0;
    const price = parseFloat(document.getElementById("posPriceInput").value) || 0;

    const warn = document.getElementById("priceWarning");
    if (item && price < item.min_price) warn.textContent = `⚠️ Below floor limit (KES ${item.min_price})!`;
    else warn.textContent = "";

    let sub = qty * price;
    let tax = sub * 0.16;
    let total = sub + tax;

    document.getElementById("posSubtotal").textContent = `KES ${sub.toLocaleString()}`;
    document.getElementById("posTax").textContent = `KES ${tax.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    document.getElementById("posFinalTotal").textContent = `KES ${total.toLocaleString(undefined, {minimumFractionDigits:2})}`;
}

async function completeOperatorSale() {
    const sku = document.getElementById("posItemSelect").value;
    const item = inventory.find(p => p.sku === sku);
    const qty = parseInt(document.getElementById("posQtyInput").value) || 0;
    const price = parseFloat(document.getElementById("posPriceInput").value) || 0;
    const mode = document.getElementById("posPaymentMode").value;

    if (!item || qty <= 0) return alert("Select item and valid quantity.");
    if (qty > item.quantity) return alert(`Insufficient stock! Only ${item.quantity} left.`);

    let sub = qty * price;
    let tax = sub * 0.16;
    let total = sub + tax;
    item.quantity -= qty;
    localStorage.setItem("rm_inventory", JSON.stringify(inventory));

    const sale = {
        operator_name: currentUser.full_name,
        item_name: item.name,
        sku: item.sku,
        category: item.category,
        quantity_sold: qty,
        unit_price: price,
        total_paid: total,
        tax_applied: tax,
        payment_mode: mode,
        created_at: new Date().toISOString()
    };
    sales.unshift(sale);
    localStorage.setItem("rm_sales", JSON.stringify(sales));

    if (_supabase) {
        _supabase.from("hardware_inventory").update({ quantity: item.quantity }).eq("sku", sku).then(() => {});
        _supabase.from("sales_reports").insert([sale]).then(() => {});
    }

    alert("Sale completed!");
    populateOperatorDropdown();
    renderOperatorLowStock();

    document.getElementById("receiptDetails").innerHTML = `
        <p>Date: ${new Date().toLocaleString()}</p>
        <p>Cashier: ${currentUser.full_name}</p>
        <p>Mode: ${mode} ${mode==='M-PESA'?'(Paybill 880100)':''}</p>
        <div style="border-top:1px dashed #333; border-bottom:1px dashed #333; padding:6px 0; margin:6px 0;">
            <strong>${item.name}</strong><br>
            ${qty} ${item.unit} @ KES ${price.toLocaleString()}<br>
            Subtotal: KES ${sub.toLocaleString()}<br>
            VAT (16%): KES ${tax.toLocaleString(undefined, {minimumFractionDigits:2})}
        </div>
        <strong>TOTAL: KES ${total.toLocaleString(undefined, {minimumFractionDigits:2})}</strong>
    `;
    document.getElementById("receiptModal").style.display = "flex";
}

function closeReceiptModal() { document.getElementById("receiptModal").style.display = "none"; }

function renderOperatorLowStock() {
    const box = document.getElementById("operatorLowStockList");
    if (!box) return;
    box.innerHTML = "";
    const low = inventory.filter(p => p.quantity <= p.threshold);
    if (low.length === 0) { box.innerHTML = `<p style="color:var(--neon-green); font-size:0.85rem;">All items above threshold.</p>`; return; }
    low.forEach(i => box.innerHTML += `<div class="mini-row"><span>${i.name}</span><span class="badge low">Left: ${i.quantity}</span></div>`);
}

function renderOperatorInquiries() {
    const box = document.getElementById("operatorInquiriesList");
    if (!box) return;
    box.innerHTML = "";
    if (inquiries.length === 0) { box.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">No recent inquiries.</p>`; return; }
    inquiries.slice(0, 5).forEach(inq => box.innerHTML += `<div class="mini-row"><span>${inq.order_summary}</span><strong>KES ${inq.total_estimated.toLocaleString()}</strong></div>`);
}

// ADMIN PORTAL
function switchAdminTab(tab) {
    document.querySelectorAll(".admin-tab-content").forEach(c => c.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(`admin-tab-${tab}`).classList.add("active");
    event.currentTarget.classList.add("active");
    if (tab === 'stock') renderAdminStockTable();
    if (tab === 'reports') renderReportsTables();
    if (tab === 'expenses') renderExpensesTable();
    if (tab === 'staff') renderStaffTable();
}

async function adminSaveStock() {
    const name = document.getElementById("admName").value.trim();
    const sku = document.getElementById("admSku").value.trim().toUpperCase();
    const category = document.getElementById("admCategory").value;
    const price = parseFloat(document.getElementById("admPrice").value);
    const cost = parseFloat(document.getElementById("admCostPrice").value) || 0;
    const min = parseFloat(document.getElementById("admMinPrice").value) || price;
    const qty = parseInt(document.getElementById("admQty").value) || 0;
    const thresh = parseInt(document.getElementById("admThreshold").value) || 10;
    const unit = document.getElementById("admUnit").value.trim() || "pcs";

    if (!name || !sku || isNaN(price)) return alert("Fill mandatory fields.");
    const item = { sku, name, category, price, cost_price: cost, min_price: min, quantity: qty, threshold: thresh, unit };
    const idx = inventory.findIndex(p => p.sku === sku);
    if (idx >= 0) inventory[idx] = item; else inventory.push(item);

    localStorage.setItem("rm_inventory", JSON.stringify(inventory));
    if (_supabase) _supabase.from("hardware_inventory").upsert([item]).then(() => {});
    alert("Stock saved successfully!");
    renderAdminStockTable();
}

function renderAdminStockTable() {
    const tbody = document.getElementById("adminStockBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    inventory.forEach(i => {
        const isLow = i.quantity <= i.threshold;
        tbody.innerHTML += `
            <tr>
                <td><code>${i.sku}</code></td>
                <td>${i.name}</td>
                <td>${i.category}</td>
                <td>KES ${i.price}</td>
                <td>KES ${i.cost_price}</td>
                <td><strong>${i.quantity} ${i.unit}</strong></td>
                <td>${i.threshold}</td>
                <td><span class="badge ${isLow ? 'low' : 'ok'}">${isLow ? 'Low Stock' : 'OK'}</span></td>
            </tr>
        `;
    });
}

function populateReportOperatorDropdown() {
    const sel = document.getElementById("repFilterOperator");
    if (!sel) return;
    sel.innerHTML = '<option value="All">All Operators</option>';
    [...new Set(sales.map(s => s.operator_name))].forEach(op => sel.innerHTML += `<option value="${op}">${op}</option>`);
}

function renderReportsTables() {
    const cat = document.getElementById("repFilterCat")?.value || "All";
    const op = document.getElementById("repFilterOperator")?.value || "All";
    const start = document.getElementById("repFilterStart")?.value;
    const end = document.getElementById("repFilterEnd")?.value;

    const filtered = sales.filter(s => {
        let mCat = (cat === 'All' || s.category === cat);
        let mOp = (op === 'All' || s.operator_name === op);
        let sDate = new Date(s.created_at);
        let mDate = true;
        if (start && sDate < new Date(start)) mDate = false;
        if (end && sDate > new Date(end + 'T23:59:59')) mDate = false;
        return mCat && mOp && mDate;
    });

    const tbody = document.getElementById("salesReportBody");
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

    const rev = filtered.reduce((a, c) => a + c.total_paid, 0);
    const exp = expenses.reduce((a, c) => a + c.amount, 0);
    const profit = rev - exp;

    if(document.getElementById("repGrossRev")) document.getElementById("repGrossRev").textContent = `KES ${rev.toLocaleString()}`;
    if(document.getElementById("repTotalExp")) document.getElementById("repTotalExp").textContent = `KES ${exp.toLocaleString()}`;
    if(document.getElementById("repNetProfit")) document.getElementById("repNetProfit").textContent = `KES ${profit.toLocaleString()}`;

    const lowBody = document.getElementById("lowStockReportBody");
    if (lowBody) {
        lowBody.innerHTML = "";
        const low = inventory.filter(p => p.quantity <= p.threshold);
        if (low.length === 0) lowBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No low stock items.</td></tr>`;
        else low.forEach(i => lowBody.innerHTML += `<tr><td><code>${i.sku}</code></td><td>${i.name}</td><td><strong>${i.quantity} ${i.unit}</strong></td><td>${i.threshold}</td><td><span class="badge low">Restock Needed</span></td></tr>`);
    }
}

function resetFilters() {
    if(document.getElementById("repFilterCat")) document.getElementById("repFilterCat").value = "All";
    if(document.getElementById("repFilterOperator")) document.getElementById("repFilterOperator").value = "All";
    if(document.getElementById("repFilterStart")) document.getElementById("repFilterStart").value = "";
    if(document.getElementById("repFilterEnd")) document.getElementById("repFilterEnd").value = "";
    renderReportsTables();
}

async function recordExpense() {
    const type = document.getElementById("expType").value;
    const amt = parseFloat(document.getElementById("expAmount").value);
    const desc = document.getElementById("expDesc").value.trim();
    if (isNaN(amt) || amt <= 0) return alert("Enter valid amount.");

    const e = { expense_type: type, amount: amt, description: desc, recorded_by: currentUser.full_name, created_at: new Date().toISOString() };
    expenses.unshift(e);
    localStorage.setItem("rm_expenses", JSON.stringify(expenses));
    if (_supabase) _supabase.from("shop_expenses").insert([e]).then(() => {});

    alert("Expense recorded!");
    document.getElementById("expAmount").value = "";
    document.getElementById("expDesc").value = "";
    renderExpensesTable();
    renderReportsTables();
}

function renderExpensesTable() {
    const tbody = document.getElementById("expensesTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    expenses.forEach(e => {
        tbody.innerHTML += `<tr><td>${new Date(e.created_at).toLocaleDateString()}</td><td><strong>${e.expense_type}</strong></td><td>KES ${e.amount.toLocaleString()}</td><td>${e.description||'-'}</td><td>${e.recorded_by}</td></tr>`;
    });
}

async function createStaffAccount() {
    const username = document.getElementById("staffUsername").value.trim().toLowerCase();
    const full_name = document.getElementById("staffName").value.trim();
    const pin = document.getElementById("staffPin").value.trim();
    const role = document.getElementById("staffRole").value;

    if (!username || !full_name || !pin) return alert("Fill out all staff fields.");
    const s = { username, full_name, pin, role };
    const idx = staff.findIndex(u => u.username === username);
    if (idx >= 0) staff[idx] = s; else staff.push(s);

    localStorage.setItem("rm_staff", JSON.stringify(staff));
    if (_supabase) _supabase.from("staff_users").upsert([s]).then(() => {});
    alert("Staff account saved!");
    renderStaffTable();
}

function renderStaffTable() {
    const tbody = document.getElementById("staffTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    staff.forEach(s => {
        tbody.innerHTML += `<tr><td><code>${s.username}</code></td><td>${s.full_name}</td><td><span class="badge ${s.role==='admin'?'low':'ok'}">${s.role.toUpperCase()}</span></td></tr>`;
    });
}

function exportReport(type) {
    if (type === 'print') return window.print();
    if (type === 'csv') {
        let csv = "Date,Operator,Item,Category,Quantity,PaymentMode,TotalPaid\n";
        sales.forEach(s => csv += `"${s.created_at}","${s.operator_name}","${s.item_name}","${s.category}",${s.quantity_sold},"${s.payment_mode}",${s.total_paid}\n`);
        const link = document.createElement("a");
        link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
        link.download = "rift_metro_sales_report.csv";
        link.click();
    }
}
