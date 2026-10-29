// ==========================================
// SUPABASE CONFIGURATION
// ==========================================
const SUPABASE_URL = 'https://htfmtwrbqrytjfnsulow.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_apSmCIhXSUOENc9lRbDoJA_-hg0EQK3';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global State
let catalogProducts = [];
let orderCart = [];
let salesLogs = [];
let expensesLogs = [];
let staffUsers = [];
let activeUser = null; // { username, role, full_name }

document.addEventListener('DOMContentLoaded', async () => {
    checkConnectionStatus();
    await fetchInventory();
    await fetchStaffUsers();
    await fetchSalesLogs();
    await fetchExpenses();
    await fetchInquiries();
});

async function checkConnectionStatus() {
    const indicator = document.getElementById('connection-status');
    if (!indicator) return;
    if (navigator.onLine) {
        indicator.textContent = "Online Synced";
        indicator.className = "badge online";
    } else {
        indicator.textContent = "Offline Mode";
        indicator.className = "badge offline";
    }
}

// ==========================================
// AUTHENTICATION & NAVIGATION ROUTING
// ==========================================
function handleNavClick(role) {
    if (role === 'viewer') {
        switchRole('viewer');
        return;
    }

    // If operator or admin is requested, check if already logged in with correct permissions
    if (activeUser && ((role === 'operator' && (activeUser.role === 'operator' || activeUser.role === 'admin')) || (role === 'admin' && activeUser.role === 'admin'))) {
        switchRole(role);
    } else {
        // Prompt security login modal
        promptLogin(role);
    }
}

function promptLogin(role) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-login').classList.add('active');
    document.getElementById('searchBarSection').style.display = 'none';
    document.getElementById('loginRolePrompt').textContent = `Please enter credentials for: ${role.toUpperCase()} portal`;
    document.getElementById('loginUser').dataset.targetRole = role;
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPin').value = '';
}

function cancelLogin() {
    if (activeUser) {
        switchRole(activeUser.role === 'admin' ? 'admin' : 'operator');
    } else {
        switchRole('viewer');
    }
}

async function executeLogin() {
    const user = document.getElementById('loginUser').value.trim();
    const pin = document.getElementById('loginPin').value.trim();
    const targetRole = document.getElementById('loginUser').dataset.targetRole;

    const { data, error } = await _supabase.from('staff_users').select('*').eq('username', user).single();

    if (error || !data || data.pin !== pin) {
        alert('Invalid Username or Security PIN.');
        return;
    }

    if (targetRole === 'admin' && data.role !== 'admin') {
        alert('Access Denied: This account does not have Admin privileges.');
        return;
    }

    activeUser = data;
    document.getElementById('current-user-display').textContent = `User: ${data.full_name} (${data.role.toUpperCase()})`;
    document.getElementById('btn-logout').style.display = 'inline-block';

    switchRole(data.role === 'admin' ? 'admin' : 'operator');
}

function triggerPasswordReset() {
    const username = prompt("Enter your Admin Username to initiate recovery reference:");
    if (!username) return;
    if (username === 'admin') {
        alert("To reset the admin password, go to your Supabase SQL Editor and execute:\nUPDATE staff_users SET pin = 'NEW_PIN' WHERE username = 'admin';");
    } else {
        alert("Please contact the primary system administrator.");
    }
}

function logoutSession() {
    activeUser = null;
    document.getElementById('current-user-display').textContent = 'Mode: Customer';
    document.getElementById('btn-logout').style.display = 'none';
    switchRole('viewer');
}

function switchRole(role) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));

    if (role === 'viewer') {
        document.getElementById('view-viewer').classList.add('active');
        document.getElementById('btn-viewer').classList.add('active');
        document.getElementById('searchBarSection').style.display = 'flex';
    } else {
        document.getElementById('searchBarSection').style.display = 'none';
        if (role === 'operator') {
            document.getElementById('view-operator').classList.add('active');
            document.getElementById('btn-operator').classList.add('active');
            document.getElementById('opActiveName').value = activeUser ? activeUser.full_name : 'Cashier';
            populateOperatorDropdown();
            renderOperatorLowStock();
            renderOperatorInquiries();
        } else if (role === 'admin') {
            document.getElementById('view-admin').classList.add('active');
            document.getElementById('btn-admin').classList.add('active');
            renderAdminStockTable();
            renderReportsTables();
            renderExpensesTable();
            renderStaffTable();
            populateReportOperatorDropdown();
        }
    }
}

// ==========================================
// DATA FETCHING FUNCTIONS
// ==========================================
async function fetchInventory() {
    const { data } = await _supabase.from('hardware_inventory').select('*');
    if (data) {
        catalogProducts = data;
        renderViewerCatalog();
    }
}

async function fetchStaffUsers() {
    const { data } = await _supabase.from('staff_users').select('*');
    if (data) staffUsers = data;
}

async function fetchSalesLogs() {
    const { data } = await _supabase.from('sales_reports').select('*').order('created_at', { ascending: false });
    if (data) salesLogs = data;
}

async function fetchExpenses() {
    const { data } = await _supabase.from('shop_expenses').select('*').order('created_at', { ascending: false });
    if (data) expensesLogs = data;
}

async function fetchInquiries() {
    const { data } = await _supabase.from('customer_inquiries').select('*').order('created_at', { ascending: false });
    if (data && document.getElementById('operatorInquiriesList')) {
        renderOperatorInquiries(data);
    }
}

// ==========================================
// 1. CATALOG & WHATSAPP / INQUIRY LOG
// ==========================================
function renderViewerCatalog() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const searchElem = document.getElementById('searchInput');
    const catElem = document.getElementById('categoryFilter');
    const search = searchElem ? searchElem.value.toLowerCase() : '';
    const cat = catElem ? catElem.value : 'All';

    const filtered = catalogProducts.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search);
        const matchesCat = (cat === 'All' || p.category === cat);
        return matchesSearch && matchesCat;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<p class="empty-msg">No hardware items found.</p>`;
        return;
    }

    filtered.forEach(item => {
        const isLow = item.quantity <= item.threshold;
        grid.innerHTML += `
            <div class="product-card">
                <div class="card-header">
                    <span class="sku-badge">${item.sku}</span>
                    <span class="stock-status ${isLow ? 'low' : 'ok'}">${isLow ? '⚠️ Low Stock' : 'In Stock'}</span>
                </div>
                <h4>${item.name}</h4>
                <p class="category-text">${item.category}</p>
                <div class="price-box">KES ${item.price.toLocaleString()} <small>/ ${item.unit}</small></div>
                <button class="action-btn" onclick="addToOrderCart('${item.sku}')">Add to Order</button>
            </div>
        `;
    });
}

function filterCatalog() { renderViewerCatalog(); }

function addToOrderCart(sku) {
    const product = catalogProducts.find(p => p.sku === sku);
    if (!product) return;
    const existing = orderCart.find(c => c.sku === sku);
    if (existing) existing.qty += 1;
    else orderCart.push({ sku: product.sku, name: product.name, price: product.price, qty: 1, unit: product.unit });
    renderOrderCart();
}

function renderOrderCart() {
    const container = document.getElementById('cartItems');
    if (!container) return;
    if (orderCart.length === 0) {
        container.innerHTML = `<p class="empty-cart">Your list is empty. Add items to request a quote or order via WhatsApp.</p>`;
        document.getElementById('cartSubtotal').textContent = 'KES 0.00';
        document.getElementById('cartVat').textContent = 'KES 0.00';
        document.getElementById('cartTotal').textContent = 'KES 0.00';
        return;
    }

    container.innerHTML = '';
    let subtotal = 0;
    orderCart.forEach((item, index) => {
        let lineTotal = item.price * item.qty;
        subtotal += lineTotal;
        container.innerHTML += `
            <div class="cart-item-row">
                <div><strong>${item.name}</strong><br><small>KES ${item.price} x ${item.qty} ${item.unit}</small></div>
                <div><span>KES ${lineTotal.toLocaleString()}</span><button onclick="removeFromCart(${index})" class="remove-btn">✕</button></div>
            </div>
        `;
    });

    let vat = subtotal * 0.16;
    let total = subtotal + vat;
    document.getElementById('cartSubtotal').textContent = `KES ${subtotal.toLocaleString()}`;
    document.getElementById('cartVat').textContent = `KES ${vat.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    document.getElementById('cartTotal').textContent = `KES ${total.toLocaleString(undefined, {minimumFractionDigits:2})}`;
}

function removeFromCart(index) { orderCart.splice(index, 1); renderOrderCart(); }

async function sendWhatsAppOrder() {
    if (orderCart.length === 0) return alert('Cart is empty.');
    let summaryText = "";
    let subtotal = 0;
    orderCart.forEach(i => {
        subtotal += (i.price * i.qty);
        summaryText += `${i.name} (${i.qty} ${i.unit}), `;
    });
    let total = subtotal * 1.16;

    await _supabase.from('customer_inquiries').insert([{
        customer_details: 'WhatsApp Customer',
        order_summary: summaryText,
        total_estimated: total
    }]);
    fetchInquiries();

    let message = `Hello Rift Metro Hardware, I would like to order:\n`;
    orderCart.forEach((i, idx) => message += `${idx+1}. ${i.name} - ${i.qty} ${i.unit} @ KES ${i.price}\n`);
    message += `\nEstimated Total (Incl. 16% VAT): KES ${total.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    message += `\nPaybill: 880100 (A/C: 117761)`;

    window.open(`https://wa.me/254716117761?text=${encodeURIComponent(message)}`, '_blank');
}

// ==========================================
// 2. OPERATOR DESK & RECEIPT GENERATION
// ==========================================
function populateOperatorDropdown() {
    const select = document.getElementById('posItemSelect');
    if (!select) return;
    select.innerHTML = '';
    catalogProducts.forEach(p => {
        select.innerHTML += `<option value="${p.sku}">${p.name} (Stock: ${p.quantity} ${p.unit})</option>`;
    });
    updatePosItemDetails();
}

function updatePosItemDetails() {
    const select = document.getElementById('posItemSelect');
    if (!select || !select.value) return;
    const sku = select.value;
    const product = catalogProducts.find(p => p.sku === sku);
    if (!product) return;
    document.getElementById('posInventoryHint').textContent = `Stock: ${product.quantity} ${product.unit} | Floor Price: KES ${product.min_price}`;
    document.getElementById('posPriceInput').value = product.price;
    calculatePosTotal();
}

function calculatePosTotal() {
    const select = document.getElementById('posItemSelect');
    if (!select || !select.value) return;
    const sku = select.value;
    const product = catalogProducts.find(p => p.sku === sku);
    const qty = parseInt(document.getElementById('posQtyInput').value) || 0;
    const price = parseFloat(document.getElementById('posPriceInput').value) || 0;

    const warning = document.getElementById('priceWarning');
    if (product && price < product.min_price) warning.textContent = `⚠️ Below floor price limit (KES ${product.min_price})!`;
    else warning.textContent = '';

    let subtotal = qty * price;
    let tax = subtotal * 0.16;
    let final = subtotal + tax;

    document.getElementById('posSubtotal').textContent = `KES ${subtotal.toLocaleString()}`;
    document.getElementById('posTax').textContent = `KES ${tax.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    document.getElementById('posFinalTotal').textContent = `KES ${final.toLocaleString(undefined, {minimumFractionDigits:2})}`;
}

async function completeOperatorSale() {
    const select = document.getElementById('posItemSelect');
    if (!select || !select.value) return alert('Please select an item.');
    const sku = select.value;
    const product = catalogProducts.find(p => p.sku === sku);
    const qtySold = parseInt(document.getElementById('posQtyInput').value) || 0;
    const unitPrice = parseFloat(document.getElementById('posPriceInput').value) || 0;
    const paymentMode = document.getElementById('posPaymentMode').value;
    const operatorName = activeUser ? activeUser.full_name : 'Cashier';

    if (!product || qtySold <= 0) return alert('Invalid product or quantity.');
    if (qtySold > product.quantity) return alert(`Insufficient stock! Only ${product.quantity} left.`);

    let subtotal = qtySold * unitPrice;
    let tax = subtotal * 0.16;
    let totalPaid = subtotal + tax;
    let newQty = product.quantity - qtySold;

    await _supabase.from('hardware_inventory').update({ quantity: newQty }).eq('sku', sku);
    
    await _supabase.from('sales_reports').insert([{
        operator_name: operatorName,
        item_name: product.name,
        sku: product.sku,
        category: product.category,
        quantity_sold: qtySold,
        unit_price: unitPrice,
        total_paid: totalPaid,
        tax_applied: tax,
        payment_mode: paymentMode
    }]);

    alert('Sale completed successfully!');
    await fetchInventory();
    await fetchSalesLogs();
    populateOperatorDropdown();
    renderOperatorLowStock();

    showThermalReceipt({
        operator: operatorName,
        item: product.name,
        qty: qtySold,
        unit: product.unit,
        price: unitPrice,
        subtotal: subtotal,
        tax: tax,
        total: totalPaid,
        mode: paymentMode,
        date: new Date().toLocaleString()
    });
}

function showThermalReceipt(data) {
    const details = document.getElementById('receiptDetails');
    details.innerHTML = `
        <p>Date: ${data.date}</p>
        <p>Cashier: ${data.operator}</p>
        <p>Payment: ${data.mode} ${data.mode === 'M-PESA' ? '(Paybill: 880100)' : ''}</p>
        <div style="border-top:1px solid #333; border-bottom:1px solid #333; margin:8px 0; padding:6px 0;">
            <strong>Item:</strong> ${data.item}<br>
            <strong>Qty:</strong> ${data.qty} ${data.unit} @ KES ${data.price}<br>
            <strong>Subtotal:</strong> KES ${data.subtotal.toLocaleString()}<br>
            <strong>VAT (16%):</strong> KES ${data.tax.toLocaleString(undefined, {minimumFractionDigits:2})}<br>
        </div>
        <p style="font-size:1.05rem; font-weight:bold;">TOTAL PAID: KES ${data.total.toLocaleString(undefined, {minimumFractionDigits:2})}</p>
    `;
    document.getElementById('receiptModal').style.display = 'flex';
}

function closeReceiptModal() { document.getElementById('receiptModal').style.display = 'none'; }

function renderOperatorLowStock() {
    const container = document.getElementById('operatorLowStockList');
    if (!container) return;
    container.innerHTML = '';
    const low = catalogProducts.filter(p => p.quantity <= p.threshold);
    if (low.length === 0) { container.innerHTML = `<p class="ok-msg" style="color:#00ff88; font-size:0.85rem;">No low stock items.</p>`; return; }
    low.forEach(i => {
        container.innerHTML += `<div class="mini-row"><span>${i.name}</span><span class="badge low">Left: ${i.quantity}</span></div>`;
    });
}

function renderOperatorInquiries(inquiriesList) {
    const container = document.getElementById('operatorInquiriesList');
    if (!container) return;
    container.innerHTML = '';
    if (!inquiriesList || inquiriesList.length === 0) { container.innerHTML = `<p class="ok-msg" style="color:var(--text-muted); font-size:0.85rem;">No recent inquiries.</p>`; return; }
    inquiriesList.slice(0, 5).forEach(inq => {
        container.innerHTML += `<div class="mini-row"><span>${inq.order_summary}</span><strong>KES ${inq.total_estimated.toLocaleString()}</strong></div>`;
    });
}

// ==========================================
// 3. ADMIN PORTAL & P&L / FILTERS / STAFF
// ==========================================
function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(`admin-tab-${tabName}`).classList.add('active');
    event.currentTarget.classList.add('active');

    if (tabName === 'stock') renderAdminStockTable();
    if (tabName === 'reports') renderReportsTables();
    if (tabName === 'expenses') renderExpensesTable();
    if (tabName === 'staff') renderStaffTable();
}

async function adminSaveStock() {
    const name = document.getElementById('admName').value.trim();
    const sku = document.getElementById('admSku').value.trim();
    const category = document.getElementById('admCategory').value;
    const price = parseFloat(document.getElementById('admPrice').value);
    const cost_price = parseFloat(document.getElementById('admCostPrice').value) || 0;
    const min_price = parseFloat(document.getElementById('admMinPrice').value);
    const quantity = parseInt(document.getElementById('admQty').value);
    const threshold = parseInt(document.getElementById('admThreshold').value);
    const unit = document.getElementById('admUnit').value.trim();

    if (!name || !sku || isNaN(price)) return alert('Fill mandatory fields.');

    await _supabase.from('hardware_inventory').upsert([{
        sku, name, category, price, cost_price, min_price, quantity, threshold, unit
    }], { onConflict: 'sku' });

    alert('Stock updated successfully in cloud database.');
    await fetchInventory();
    renderAdminStockTable();
}

function renderAdminStockTable() {
    const tbody = document.getElementById('adminStockBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    catalogProducts.forEach(i => {
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
    const select = document.getElementById('repFilterOperator');
    if (!select) return;
    select.innerHTML = '<option value="All">All Operators</option>';
    let uniqueOps = [...new Set(salesLogs.map(s => s.operator_name))];
    uniqueOps.forEach(op => select.innerHTML += `<option value="${op}">${op}</option>`);
}

function renderReportsTables() {
    const catFilterElem = document.getElementById('repFilterCat');
    const opFilterElem = document.getElementById('repFilterOperator');
    const startElem = document.getElementById('repFilterStart');
    const endElem = document.getElementById('repFilterEnd');

    const catFilter = catFilterElem ? catFilterElem.value : 'All';
    const opFilter = opFilterElem ? opFilterElem.value : 'All';
    const startDate = startElem ? startElem.value : '';
    const endDate = endElem ? endElem.value : '';

    let filteredSales = salesLogs.filter(s => {
        let matchCat = (catFilter === 'All' || s.category === catFilter);
        let matchOp = (opFilter === 'All' || s.operator_name === opFilter);
        let sDate = new Date(s.created_at);
        let matchDate = true;
        if (startDate && sDate < new Date(startDate)) matchDate = false;
        if (endDate && sDate > new Date(endDate + 'T23:59:59')) matchDate = false;
        return matchCat && matchOp && matchDate;
    });

    const salesBody = document.getElementById('salesReportBody');
    if (salesBody) {
        salesBody.innerHTML = '';
        filteredSales.forEach(s => {
            salesBody.innerHTML += `
                <tr>
                    <td>${new Date(s.created_at).toLocaleString()}</td>
                    <td>${s.operator_name}</td>
                    <td>${s.item_name}</td>
                    <td>${s.category}</td>
                    <td>${s.quantity_sold}</td>
                    <td><span style="font-size:0.8rem; background:#040812; padding:2px 5px; border-radius:4px;">${s.payment_mode}</span></td>
                    <td>KES ${s.total_paid.toLocaleString(undefined, {minimumFractionDigits:2})}</td>
                </tr>
            `;
        });
    }

    let grossRev = filteredSales.reduce((acc, curr) => acc + curr.total_paid, 0);
    let totalExp = expensesLogs.reduce((acc, curr) => acc + curr.amount, 0);
    let netProfit = grossRev - totalExp;

    if(document.getElementById('repGrossRev')) document.getElementById('repGrossRev').textContent = `KES ${grossRev.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(document.getElementById('repTotalExp')) document.getElementById('repTotalExp').textContent = `KES ${totalExp.toLocaleString(undefined, {minimumFractionDigits:2})}`;
    if(document.getElementById('repNetProfit')) document.getElementById('repNetProfit').textContent = `KES ${netProfit.toLocaleString(undefined, {minimumFractionDigits:2})}`;

    const lowBody = document.getElementById('lowStockReportBody');
    if (lowBody) {
        lowBody.innerHTML = '';
        let lowItems = catalogProducts.filter(p => p.quantity <= p.threshold);
        if (lowItems.length === 0) {
            lowBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">All items above threshold.</td></tr>`;
        } else {
            lowItems.forEach(i => {
                lowBody.innerHTML += `<tr><td><code>${i.sku}</code></td><td>${i.name}</td><td><strong>${i.quantity} ${i.unit}</strong></td><td>${i.threshold}</td><td><span class="badge low">Restock Needed</span></td></tr>`;
            });
        }
    }
}

function resetFilters() {
    if(document.getElementById('repFilterCat')) document.getElementById('repFilterCat').value = 'All';
    if(document.getElementById('repFilterOperator')) document.getElementById('repFilterOperator').value = 'All';
    if(document.getElementById('repFilterStart')) document.getElementById('repFilterStart').value = '';
    if(document.getElementById('repFilterEnd')) document.getElementById('repFilterEnd').value = '';
    renderReportsTables();
}

async function recordExpense() {
    const expense_type = document.getElementById('expType').value;
    const amount = parseFloat(document.getElementById('expAmount').value);
    const description = document.getElementById('expDesc').value.trim();
    const recorded_by = activeUser ? activeUser.full_name : 'Admin';

    if (isNaN(amount) || amount <= 0) return alert('Enter valid amount.');

    await _supabase.from('shop_expenses').insert([{ expense_type, amount, description, recorded_by }]);
    alert('Expense recorded successfully.');
    document.getElementById('expAmount').value = '';
    document.getElementById('expDesc').value = '';
    await fetchExpenses();
    renderExpensesTable();
    renderReportsTables();
}

function renderExpensesTable() {
    const tbody = document.getElementById('expensesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    expensesLogs.forEach(e => {
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

async function createStaffAccount() {
    const username = document.getElementById('staffUsername').value.trim().toLowerCase();
    const full_name = document.getElementById('staffName').value.trim();
    const pin = document.getElementById('staffPin').value.trim();
    const role = document.getElementById('staffRole').value;

    if (!username || !full_name || !pin) return alert('Fill out all staff fields.');

    await _supabase.from('staff_users').upsert([{ username, full_name, pin, role }], { onConflict: 'username' });
    alert('Staff account saved successfully.');
    await fetchStaffUsers();
    renderStaffTable();
}

function renderStaffTable() {
    const tbody = document.getElementById('staffTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    staffUsers.forEach(u => {
        tbody.innerHTML += `
            <tr>
                <td><code>${u.username}</code></td>
                <td>${u.full_name}</td>
                <td><span class="badge ${u.role === 'admin' ? 'low' : 'ok'}">${u.role.toUpperCase()}</span></td>
                <td>-</td>
            </tr>
        `;
    });
}

function exportReport(type) {
    if (type === 'print') return window.print();
    if (type === 'csv') {
        let csv = "Date,Operator,Item,Category,Quantity,PaymentMode,TotalPaid\n";
        salesLogs.forEach(s => csv += `"${s.created_at}","${s.operator_name}","${s.item_name}","${s.category}",${s.quantity_sold},"${s.payment_mode}",${s.total_paid}\n`);
        const link = document.createElement("a");
        link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
        link.download = "rift_metro_sales_report.csv";
        link.click();
    }
}
