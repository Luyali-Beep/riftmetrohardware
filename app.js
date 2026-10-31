const SUPABASE_URL = 'https://htfmtwrbqrytjfnsulow.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_apSmCIhXSUOENc9lRbDoJA_-hg0EQK3';
let _supabase = null;
if (window.supabase) _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEFAULT_SETTINGS = { phone: "0716117761 / 0790453707", location: "Nakuru • Next to Sakinya Motors", paybill: "880100", account_no: "117761" };
const DEFAULT_STAFF = [{ username: "admin", pin: "1234", role: "admin", full_name: "Manager" }, { username: "operator1", pin: "1111", role: "operator", full_name: "Cashier" }];

let shopSettings = DEFAULT_SETTINGS;
let inventory = [], staff = [], sales = [], expenses = [], inquiries = [], restocks = [], creditSales = [];
let cart = [], posCart = [];
let currentUser = null, pendingTargetRole = null;

document.addEventListener("DOMContentLoaded", async () => {
    shopSettings = JSON.parse(localStorage.getItem("rm_settings")) || DEFAULT_SETTINGS;
    inventory = JSON.parse(localStorage.getItem("rm_inventory")) || [];
    staff = JSON.parse(localStorage.getItem("rm_staff")) || DEFAULT_STAFF;
    sales = JSON.parse(localStorage.getItem("rm_sales")) || [];
    expenses = JSON.parse(localStorage.getItem("rm_expenses")) || [];
    inquiries = JSON.parse(localStorage.getItem("rm_inquiries")) || [];
    restocks = JSON.parse(localStorage.getItem("rm_restocks")) || [];
    creditSales = JSON.parse(localStorage.getItem("rm_credit")) || [];

    document.getElementById("headerLocation").textContent = shopSettings.location;
    document.getElementById("headerPaybill").textContent = shopSettings.paybill;
    document.getElementById("headerAccount").textContent = shopSettings.account_no;
    document.getElementById("headerPhones").textContent = shopSettings.phone;

    renderViewerCatalog();
    renderOrderCart();
    toggleStockMode(); // Initialize stock form
});

// NAVIGATION & LOGIN
function handleNavClick(role) {
    if (role === 'viewer') return switchRole('viewer');
    if (currentUser && ((role === 'operator' && currentUser.role !== 'viewer') || (role === 'admin' && currentUser.role === 'admin'))) {
        return switchRole(role);
    }
    pendingTargetRole = role;
    document.getElementById("loginUser").value = ""; document.getElementById("loginPin").value = "";
    document.getElementById("loginModal").style.display = "flex";
}
function closeLoginModal() { document.getElementById("loginModal").style.display = "none"; pendingTargetRole = null; }

function executeLogin() {
    const user = document.getElementById("loginUser").value.trim().toLowerCase();
    const pin = document.getElementById("loginPin").value.trim();
    const staffMem = staff.find(u => u.username.toLowerCase() === user && u.pin === pin);
    if (!staffMem) return alert("Invalid Username or PIN.");
    if (pendingTargetRole === 'admin' && staffMem.role !== 'admin') return alert("Access Denied: Admin required.");
    
    currentUser = staffMem;
    document.getElementById("current-user-display").textContent = `Active: ${staffMem.full_name}`;
    document.getElementById("btn-logout").style.display = "inline-block";
    closeLoginModal();
    switchRole(staffMem.role === 'admin' ? 'admin' : 'operator');
}
function logoutSession() { currentUser = null; document.getElementById("btn-logout").style.display = "none"; switchRole("viewer"); }

function switchRole(role) {
    document.querySelectorAll(".app-view, .role-btn").forEach(e => e.classList.remove("active"));
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
            document.getElementById("opActiveName").value = currentUser.full_name;
            populateOperatorDropdown(); renderOperatorInquiries(); renderOperatorLowStock();
        } else if (role === 'admin') {
            document.getElementById("view-admin").classList.add("active");
            document.getElementById("btn-admin").classList.add("active");
            renderAdminStockTable(); renderReportsTables(); renderExpensesTable(); renderDebtorsTable();
        }
    }
}

// CUSTOMER CATALOG & CART
function renderViewerCatalog() {
    const grid = document.getElementById("productGrid");
    const query = (document.getElementById("searchInput")?.value || "").toLowerCase();
    const cat = document.getElementById("categoryFilter")?.value || "All";

    const filtered = inventory.filter(p => (p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query)) && (cat === "All" || p.category === cat));
    grid.innerHTML = filtered.length ? "" : `<div style="grid-column:1/-1; padding:40px; text-align:center; color:#999;">No items found.</div>`;

    filtered.forEach(item => {
        grid.innerHTML += `
            <div class="product-card">
                <div>
                    <div class="card-header"><span class="sku-badge">${item.sku}</span><span class="badge ok">Stock: ${item.quantity}</span></div>
                    <h4>${item.name}</h4><p class="category-text">${item.category}</p>
                </div>
                <div>
                    <div class="price-box">KES ${item.price.toLocaleString()} <small>/ ${item.unit}</small></div>
                    <button class="action-btn" onclick="addToOrderCart('${item.sku}')">+ Add to Basket</button>
                </div>
            </div>`;
    });
}
function filterCatalog() { renderViewerCatalog(); }

function addToOrderCart(sku) {
    const item = inventory.find(p => p.sku === sku);
    const existing = cart.find(c => c.sku === sku);
    if (existing) {
        if (existing.qty + 1 > item.quantity) return alert("Max stock reached.");
        existing.qty += 1;
    } else cart.push({ sku: item.sku, name: item.name, price: item.price, unit: item.unit, qty: 1, max: item.quantity });
    renderOrderCart();
}
function updateCartQty(idx, val) {
    let q = parseInt(val);
    if (isNaN(q) || q <= 0) return removeFromCart(idx);
    if (q > cart[idx].max) { alert("Exceeds available stock!"); q = cart[idx].max; }
    cart[idx].qty = q;
    renderOrderCart();
}
function removeFromCart(idx) { cart.splice(idx, 1); renderOrderCart(); }

function renderOrderCart() {
    const container = document.getElementById("cartItems");
    if (cart.length === 0) {
        container.innerHTML = `<p class="empty-cart">Your list is empty.</p>`;
        document.getElementById("cartSubtotal").textContent = "KES 0.00"; document.getElementById("cartVat").textContent = "KES 0.00"; document.getElementById("cartTotal").textContent = "KES 0.00";
        return;
    }
    container.innerHTML = "";
    let subtotal = 0;
    cart.forEach((c, idx) => {
        let line = c.price * c.qty; subtotal += line;
        container.innerHTML += `
            <div class="cart-item-row">
                <div style="flex:1;"><strong>${c.name}</strong><br><small>KES ${c.price.toLocaleString()} / ${c.unit}</small></div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="number" value="${c.qty}" min="1" max="${c.max}" onchange="updateCartQty(${idx}, this.value)" style="width:60px; padding:4px; background:#090e1b; color:#fff; border:1px solid #333; border-radius:4px;">
                    <span style="width:80px; text-align:right;">KES ${line.toLocaleString()}</span>
                    <button onclick="removeFromCart(${idx})" class="remove-btn">✕</button>
                </div>
            </div>`;
    });
    let vat = subtotal * 0.16; let grand = subtotal + vat;
    document.getElementById("cartSubtotal").textContent = `KES ${subtotal.toLocaleString()}`;
    document.getElementById("cartVat").textContent = `KES ${vat.toLocaleString()}`;
    document.getElementById("cartTotal").textContent = `KES ${grand.toLocaleString()}`;
}

function sendWhatsAppOrder() {
    if (cart.length === 0) return alert("Basket is empty.");
    let summary = "", subtotal = 0;
    cart.forEach(i => { subtotal += (i.price * i.qty); summary += `${i.name} (${i.qty}), `; });
    let total = subtotal * 1.16;

    const inq = { id: Date.now(), order_summary: summary, total_estimated: total, cart_data: cart, status: 'Pending', created_at: new Date().toISOString() };
    inquiries.unshift(inq); localStorage.setItem("rm_inquiries", JSON.stringify(inquiries));
    
    let msg = `*NEW INQUIRY - RIFT METRO*\n\n`;
    cart.forEach((i, idx) => msg += `${idx+1}. ${i.name} - ${i.qty} ${i.unit} @ KES ${i.price}\n`);
    msg += `\n*Total (Incl. VAT): KES ${total.toLocaleString()}*`;
    window.open(`https://wa.me/254${shopSettings.phone.split('/')[0].replace(/^0/, '')}?text=${encodeURIComponent(msg)}`, "_blank");
    cart = []; renderOrderCart();
}

// MULTI-ITEM POS (OPERATOR DESK)
function populateOperatorDropdown() {
    const sel = document.getElementById("posItemSelect");
    sel.innerHTML = '<option value="">-- Select Item --</option>';
    inventory.forEach(p => sel.innerHTML += `<option value="${p.sku}">${p.name} (Stock: ${p.quantity})</option>`);
}
function updatePosItemDetails() {
    const sku = document.getElementById("posItemSelect").value;
    const item = inventory.find(p => p.sku === sku);
    if (!item) return;
    document.getElementById("posInventoryHint").textContent = `Stock Available: ${item.quantity} ${item.unit} | Floor Limit: KES ${item.min_price.toLocaleString()}`;
    document.getElementById("posPriceInput").value = item.price;
}
function togglePosPaymentFields() {
    const mode = document.getElementById("posPaymentMode").value;
    document.getElementById("posRefGroup").classList.toggle("hidden", mode === "Cash" || mode === "Credit");
    document.getElementById("posCreditGroup").classList.toggle("hidden", mode !== "Credit");
}

function addPosItemToCart() {
    const sku = document.getElementById("posItemSelect").value;
    const qty = parseInt(document.getElementById("posQtyInput").value);
    const price = parseFloat(document.getElementById("posPriceInput").value);
    const item = inventory.find(p => p.sku === sku);
    
    if (!item || isNaN(qty) || qty <= 0) return alert("Select item and valid quantity.");
    if (qty > item.quantity) return alert(`Insufficient stock. Only ${item.quantity} left.`);
    if (price < item.min_price) return alert(`❌ SALE BLOCKED: Price is below authorized floor limit (KES ${item.min_price}).`);

    const existing = posCart.find(c => c.sku === sku);
    if (existing) existing.qty += qty;
    else posCart.push({ sku: item.sku, name: item.name, price, qty, unit: item.unit });
    
    renderPosCart();
    document.getElementById("posItemSelect").value = "";
    document.getElementById("posQtyInput").value = "1";
}

function removePosCartItem(idx) { posCart.splice(idx, 1); renderPosCart(); }

function renderPosCart() {
    const box = document.getElementById("posOperatorCart");
    box.innerHTML = "";
    let subtotal = 0;
    posCart.forEach((c, idx) => {
        let line = c.price * c.qty; subtotal += line;
        box.innerHTML += `
            <div class="cart-item-row" style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.05);">
                <div style="flex:1;"><strong>${c.name}</strong><br><small>${c.qty} ${c.unit} @ KES ${c.price.toLocaleString()}</small></div>
                <div><strong>KES ${line.toLocaleString()}</strong> <button onclick="removePosCartItem(${idx})" class="remove-btn">✕</button></div>
            </div>`;
    });
    document.getElementById("posSubtotal").textContent = `KES ${subtotal.toLocaleString()}`;
    document.getElementById("posFinalTotal").textContent = `KES ${(subtotal * 1.16).toLocaleString()}`;
}

function completeOperatorSale() {
    if (posCart.length === 0) return alert("POS Cart is empty.");
    const mode = document.getElementById("posPaymentMode").value;
    const refCode = document.getElementById("posRefCode").value.trim();
    
    if ((mode === "M-PESA" || mode === "Bank/Cheque") && !refCode) return alert("Please enter the Transaction Reference Code.");
    
    let totalSub = 0, summaryStr = "";
    posCart.forEach(c => {
        totalSub += (c.price * c.qty); summaryStr += `${c.name} (${c.qty}), `;
        let invItem = inventory.find(i => i.sku === c.sku);
        if (invItem) invItem.quantity -= c.qty;
    });
    
    const tax = totalSub * 0.16;
    const finalTotal = totalSub + tax;
    const rcptNo = "RCPT-" + Math.floor(10000 + Math.random() * 90000);

    // If Credit, validate and push to Debtors
    if (mode === "Credit") {
        const cName = document.getElementById("posCreditName").value.trim();
        const cPhone = document.getElementById("posCreditPhone").value.trim();
        const cDate = document.getElementById("posCreditDate").value;
        if (!cName || !cPhone || !cDate) return alert("Fill all Customer Credit details.");
        
        creditSales.push({
            id: Date.now(), receipt_no: rcptNo, customer: cName, phone: cPhone, items_summary: summaryStr,
            total_amount: finalTotal, paid_amount: 0, balance: finalTotal, due_date: cDate, status: "Unpaid"
        });
        localStorage.setItem("rm_credit", JSON.stringify(creditSales));
    }

    const sale = {
        receipt_no: rcptNo, operator_name: currentUser.full_name, items_sold: summaryStr,
        total_paid: finalTotal, payment_mode: mode, ref_code: refCode || '-', created_at: new Date().toISOString()
    };
    sales.unshift(sale);
    localStorage.setItem("rm_sales", JSON.stringify(sales));
    localStorage.setItem("rm_inventory", JSON.stringify(inventory));

    // Print Receipt
    let rcptHTML = `<p><strong>Receipt No:</strong> ${rcptNo}<br><strong>Date:</strong> ${new Date().toLocaleString()}<br><strong>Cashier:</strong> ${currentUser.full_name}<br><strong>Mode:</strong> ${mode} ${refCode ? '('+refCode+')':''}</p><div class="receipt-divider"></div>`;
    posCart.forEach(c => rcptHTML += `<div style="margin:6px 0;"><strong>${c.name}</strong><br>${c.qty} ${c.unit} @ KES ${c.price} = KES ${(c.qty*c.price).toLocaleString()}</div>`);
    rcptHTML += `<div class="receipt-divider"></div><p style="font-size:1.1rem;"><strong>TOTAL: KES ${finalTotal.toLocaleString()}</strong></p>`;
    if (mode==="Credit") rcptHTML += `<p><strong>Billed To:</strong> ${document.getElementById("posCreditName").value}<br><strong>Due:</strong> ${document.getElementById("posCreditDate").value}</p>`;
    
    document.getElementById("receiptDetails").innerHTML = rcptHTML;
    document.getElementById("receiptModal").style.display = "flex";

    // Reset
    posCart = []; renderPosCart(); document.getElementById("posRefCode").value = "";
    document.getElementById("posCreditName").value = ""; document.getElementById("posCreditPhone").value = "";
    populateOperatorDropdown(); renderOperatorLowStock();
}

function loadInquiryToPOS(id) {
    const inq = inquiries.find(i => i.id === id);
    if (!inq || !inq.cart_data) return;
    posCart = [...inq.cart_data];
    inq.status = 'Fulfilled';
    localStorage.setItem("rm_inquiries", JSON.stringify(inquiries));
    renderPosCart(); renderOperatorInquiries();
    alert("Online Order loaded to POS Cart. Verify payment and Complete Sale.");
}

function renderOperatorInquiries() {
    const box = document.getElementById("operatorInquiriesList");
    if (!box) return;
    box.innerHTML = "";
    const pending = inquiries.filter(i => i.status === 'Pending');
    if (pending.length === 0) return box.innerHTML = `<p style="color:#999; font-size:0.85rem;">No pending online orders.</p>`;
    pending.forEach(inq => box.innerHTML += `<div class="mini-row"><div style="flex:1;"><span>${inq.order_summary}</span><br><strong style="color:var(--neon-cyan);">KES ${inq.total_estimated.toLocaleString()}</strong></div> <button onclick="loadInquiryToPOS(${inq.id})" class="action-btn" style="width:auto; padding:6px 10px; font-size:0.75rem;">Fulfill</button></div>`);
}

function renderOperatorLowStock() {
    const box = document.getElementById("operatorLowStockList");
    if (!box) return;
    box.innerHTML = "";
    const low = inventory.filter(p => p.quantity <= p.threshold);
    if (low.length === 0) return box.innerHTML = `<p style="color:var(--neon-green); font-size:0.85rem;">Stock levels optimal.</p>`;
    low.forEach(i => box.innerHTML += `<div class="mini-row"><span>${i.name}</span><span class="badge low">${i.quantity} left</span></div>`);
}


// ADMIN PORTAL - INVENTORY & RESTOCKING
function switchAdminTab(tab, e) {
    document.querySelectorAll(".admin-tab-content, .tab-btn").forEach(el => el.classList.remove("active"));
    document.getElementById(`admin-tab-${tab}`).classList.add("active");
    if (e) e.currentTarget.classList.add("active");
    if (tab==='stock') renderAdminStockTable();
    if (tab==='reports') renderReportsTables();
    if (tab==='credit') renderDebtorsTable();
}

function toggleStockMode() {
    const mode = document.getElementById("admStockMode").value;
    const selGrp = document.getElementById("skuSelectGroup");
    const skuInp = document.getElementById("admSku");
    const btn = document.getElementById("btnSaveStock");
    const lblQty = document.getElementById("lblQtyAdd");

    if (mode === 'restock') {
        selGrp.style.display = 'block'; skuInp.readOnly = true;
        btn.textContent = "Apply Restock Update"; lblQty.textContent = "Quantity to Add (Restock)";
        const sel = document.getElementById("admExistingSku");
        sel.innerHTML = '<option value="">-- Pick Item to Restock --</option>';
        inventory.forEach(i => sel.innerHTML += `<option value="${i.sku}">${i.sku} - ${i.name}</option>`);
    } else {
        selGrp.style.display = 'none'; skuInp.readOnly = false; skuInp.value = "";
        btn.textContent = "Add Brand New Item"; lblQty.textContent = "Initial Total Quantity";
        document.querySelectorAll("#stockFieldsGrid input").forEach(i => i.value="");
    }
}

function loadExistingStock() {
    const sku = document.getElementById("admExistingSku").value;
    const item = inventory.find(i => i.sku === sku);
    if (!item) return;
    document.getElementById("admSku").value = item.sku;
    document.getElementById("admName").value = item.name;
    document.getElementById("admCategory").value = item.category;
    document.getElementById("admPrice").value = item.price;
    document.getElementById("admCostPrice").value = item.cost_price;
    document.getElementById("admMinPrice").value = item.min_price;
    document.getElementById("admQty").value = "0"; // Reset for restock addition
    document.getElementById("admThreshold").value = item.threshold;
    document.getElementById("admUnit").value = item.unit;
}

function adminSaveStock() {
    const mode = document.getElementById("admStockMode").value;
    const sku = document.getElementById("admSku").value.trim().toUpperCase();
    const name = document.getElementById("admName").value.trim();
    const price = parseFloat(document.getElementById("admPrice").value);
    const qtyInput = parseInt(document.getElementById("admQty").value) || 0;

    if (!sku || !name || isNaN(price)) return alert("Fill mandatory fields.");
    
    let target = inventory.find(i => i.sku === sku);
    if (mode === 'new' && target) return alert("SKU already exists! Use Restock mode.");

    let newQty = qtyInput;
    if (mode === 'restock') {
        if (!target) return alert("Item not found for restock.");
        newQty = target.quantity + qtyInput; // Add to existing
        // Log Restock
        if (qtyInput > 0) {
            restocks.unshift({ date: new Date().toISOString(), sku, name, qty_added: qtyInput, new_total: newQty, operator: currentUser.full_name });
            localStorage.setItem("rm_restocks", JSON.stringify(restocks));
        }
    }

    const item = {
        sku, name, category: document.getElementById("admCategory").value, price,
        cost_price: parseFloat(document.getElementById("admCostPrice").value)||0,
        min_price: parseFloat(document.getElementById("admMinPrice").value)||price,
        quantity: newQty, threshold: parseInt(document.getElementById("admThreshold").value)||10,
        unit: document.getElementById("admUnit").value || "pcs"
    };

    if (mode === 'new') inventory.push(item); else Object.assign(target, item);
    localStorage.setItem("rm_inventory", JSON.stringify(inventory));
    
    alert(`Success! ${name} stock is now ${newQty}. Pricing updated.`);
    toggleStockMode(); renderAdminStockTable();
}

function renderAdminStockTable() {
    const tbody = document.getElementById("adminStockBody");
    tbody.innerHTML = "";
    inventory.forEach(i => {
        const isLow = i.quantity <= i.threshold;
        tbody.innerHTML += `<tr><td><code>${i.sku}</code></td><td>${i.name}</td><td>KES ${i.price}</td><td>KES ${i.cost_price}</td><td><strong>${i.quantity}</strong></td><td>${i.threshold}</td><td><span class="badge ${isLow?'low':'ok'}">${isLow?'Low':'Optimal'}</span></td></tr>`;
    });
}

// REPORTS
function renderReportsTables() {
    const sBody = document.getElementById("salesReportBody");
    sBody.innerHTML = "";
    let rev = 0;
    sales.forEach(s => {
        rev += s.total_paid;
        sBody.innerHTML += `<tr><td>${s.receipt_no}</td><td>${new Date(s.created_at).toLocaleDateString()}</td><td>${s.operator_name}</td><td>${s.items_sold}</td><td>${s.payment_mode}</td><td>${s.ref_code}</td><td><strong>KES ${s.total_paid.toLocaleString()}</strong></td></tr>`;
    });
    const exp = expenses.reduce((a,c) => a + c.amount, 0);
    document.getElementById("repGrossRev").textContent = `KES ${rev.toLocaleString()}`;
    document.getElementById("repTotalExp").textContent = `KES ${exp.toLocaleString()}`;
    document.getElementById("repNetProfit").textContent = `KES ${(rev - exp).toLocaleString()}`;

    const rBody = document.getElementById("restockReportBody");
    rBody.innerHTML = "";
    restocks.forEach(r => {
        rBody.innerHTML += `<tr><td>${new Date(r.date).toLocaleDateString()}</td><td>${r.name}</td><td><code>${r.sku}</code></td><td><span style="color:var(--neon-green)">+${r.qty_added}</span></td><td>${r.new_total}</td><td>${r.operator}</td></tr>`;
    });
}

// DEBTORS & CREDIT
function renderDebtorsTable() {
    const tbody = document.getElementById("debtorsTableBody");
    tbody.innerHTML = "";
    creditSales.forEach(c => {
        const isOverdue = new Date(c.due_date) < new Date() && c.status !== 'Cleared';
        let bClass = c.status === 'Cleared' ? 'ok' : (isOverdue ? 'low' : 'online');
        let statText = isOverdue ? 'OVERDUE' : c.status;
        tbody.innerHTML += `
            <tr>
                <td>${c.receipt_no}</td><td>${c.customer}</td><td>${c.phone}</td>
                <td>KES ${c.total_amount.toLocaleString()}</td><td>KES ${c.paid_amount.toLocaleString()}</td>
                <td><strong style="color:${c.balance>0?'#ff4757':'#00ff88'}">KES ${c.balance.toLocaleString()}</strong></td>
                <td>${new Date(c.due_date).toLocaleDateString()}</td>
                <td><span class="badge ${bClass}">${statText}</span></td>
                <td>
                    ${c.balance > 0 ? `<button class="action-btn" style="padding:4px 8px; font-size:0.7rem; width:auto;" onclick="openPaymentModal(${c.id})">Pay</button>` : ''}
                    ${c.balance > 0 ? `<button class="action-btn secondary" style="padding:4px 8px; font-size:0.7rem; width:auto; background:#25D366;" onclick="sendDebtReminder(${c.id})">Ping</button>` : ''}
                </td>
            </tr>`;
    });
}
function openPaymentModal(id) {
    const c = creditSales.find(x => x.id === id);
    if (!c) return;
    document.getElementById("payModalRcpt").textContent = c.receipt_no;
    document.getElementById("payModalBal").textContent = c.balance.toLocaleString();
    document.getElementById("payModalAmt").value = c.balance;
    document.getElementById("payModalId").value = c.id;
    document.getElementById("paymentModal").style.display = "flex";
}
function closePaymentModal() { document.getElementById("paymentModal").style.display = "none"; }

function submitPartialPayment() {
    const id = parseInt(document.getElementById("payModalId").value);
    const amt = parseFloat(document.getElementById("payModalAmt").value);
    const mode = document.getElementById("payModalMode").value;
    const ref = document.getElementById("payModalRef").value || "-";
    
    const credit = creditSales.find(c => c.id === id);
    if (!credit || isNaN(amt) || amt <= 0 || amt > credit.balance) return alert("Invalid amount.");
    
    credit.paid_amount += amt;
    credit.balance -= amt;
    if (credit.balance <= 0) credit.status = 'Cleared';
    
    sales.unshift({ receipt_no: `PAY-${credit.receipt_no}`, operator_name: currentUser.full_name, items_sold: `Debt Recovery: ${credit.customer}`, total_paid: amt, payment_mode: mode, ref_code: ref, created_at: new Date().toISOString() });
    
    localStorage.setItem("rm_credit", JSON.stringify(creditSales));
    localStorage.setItem("rm_sales", JSON.stringify(sales));
    closePaymentModal(); renderDebtorsTable(); renderReportsTables();
    alert("Payment recorded successfully.");
}
function sendDebtReminder(id) {
    const c = creditSales.find(x => x.id === id);
    let msg = `Hello ${c.customer},\nThis is a polite reminder from Rift Metro Hardware regarding your outstanding balance of KES ${c.balance.toLocaleString()} (Receipt: ${c.receipt_no}) due on ${new Date(c.due_date).toLocaleDateString()}.\nKindly arrange for settlement. Paybill: 880100 A/C: 117761.`;
    window.open(`https://wa.me/254${c.phone.replace(/^0/, '')}?text=${encodeURIComponent(msg)}`, "_blank");
}

function recordExpense() {
    const e = { expense_type: document.getElementById("expType").value, amount: parseFloat(document.getElementById("expAmount").value), description: document.getElementById("expDesc").value, recorded_by: currentUser.full_name, created_at: new Date().toISOString() };
    if (isNaN(e.amount)) return;
    expenses.unshift(e); localStorage.setItem("rm_expenses", JSON.stringify(expenses));
    renderExpensesTable(); renderReportsTables();
}
function renderExpensesTable() {
    const tbody = document.getElementById("expensesTableBody");
    tbody.innerHTML = "";
    expenses.forEach(e => tbody.innerHTML += `<tr><td>${new Date(e.created_at).toLocaleDateString()}</td><td>${e.expense_type}</td><td>KES ${e.amount}</td><td>${e.description}</td><td>${e.recorded_by}</td></tr>`);
}
