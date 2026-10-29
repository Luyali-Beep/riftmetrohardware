// ==========================================
// SUPABASE CLOUD CONFIGURATION
// ==========================================
// Replace these with your actual Supabase Project URL and public anon key from your Supabase dashboard
const SUPABASE_URL = 'https://YOUR-SUPABASE-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-SUPABASE-ANON-KEY';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global State Variables
let catalogProducts = [];
let orderCart = [];
let globalSettings = { phone: '254727987669', email: 'luyashliz@gmail.com' };
let salesLogs = [];

// ==========================================
// INITIALIZATION & CONNECTION MONITOR
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    checkConnectionStatus();
    await fetchShopSettings();
    await fetchInventory();
    await fetchSalesLogs();
});

async function checkConnectionStatus() {
    const indicator = document.getElementById('connection-status');
    if (navigator.onLine) {
        indicator.textContent = "Online (Cloud Synced)";
        indicator.className = "badge online";
    } else {
        indicator.textContent = "Offline (Cached Mode)";
        indicator.className = "badge offline";
    }
}
window.addEventListener('online', checkConnectionStatus);
window.addEventListener('offline', checkConnectionStatus);

// ==========================================
// ROLE SWITCHING ENGINE
// ==========================================
function switchRole(role) {
    document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(`view-${role}`).classList.add('active');
    document.getElementById(`btn-${role}`).classList.add('active');

    if (role === 'operator') {
        populateOperatorDropdown();
        renderOperatorLowStock();
    }
    if (role === 'admin') {
        renderAdminStockTable();
        renderReportsTables();
    }
}

// ==========================================
// DATA FETCHING FROM SUPABASE
// ==========================================
async function fetchInventory() {
    const { data, error } = await _supabase.from('hardware_inventory').select('*');
    if (error) {
        console.warn('Fetching from cloud failed, loading local storage cache:', error);
        loadLocalCache();
    } else {
        catalogProducts = data || [];
        localStorage.setItem('cached_hardware_inventory', JSON.stringify(catalogProducts));
        renderViewerCatalog();
    }
}

function loadLocalCache() {
    const cached = localStorage.getItem('cached_hardware_inventory');
    if (cached) {
        catalogProducts = JSON.parse(cached);
        renderViewerCatalog();
    }
}

async function fetchShopSettings() {
    const { data } = await _supabase.from('shop_settings').select('*').single();
    if (data) {
        globalSettings = data;
        if(document.getElementById('settingPhone')) {
            document.getElementById('settingPhone').value = data.phone;
            document.getElementById('settingEmail').value = data.email;
        }
    }
}

async function fetchSalesLogs() {
    const { data } = await _supabase.from('sales_reports').select('*').order('created_at', { ascending: false });
    if (data) salesLogs = data;
}

// ==========================================
// 1. VIEWER CATALOG & WHATSAPP ORDER CART
// ==========================================
function renderViewerCatalog() {
    const grid = document.getElementById('productGrid');
    grid.innerHTML = '';

    const search = document.getElementById('searchInput').value.toLowerCase();
    const cat = document.getElementById('categoryFilter').value;

    const filtered = catalogProducts.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search);
        const matchesCat = (cat === 'All' || p.category === cat);
        return matchesSearch && matchesCat;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<p class="empty-msg">No hardware items found matching your filter criteria.</p>`;
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
                <button class="action-btn" onclick="addToOrderCart('${item.sku}')">Add to Order List</button>
            </div>
        `;
    });
}

function filterCatalog() {
    renderViewerCatalog();
}

function addToOrderCart(sku) {
    const product = catalogProducts.find(p => p.sku === sku);
    if (!product) return;

    const existing = orderCart.find(c => c.sku === sku);
    if (existing) {
        existing.qty += 1;
    } else {
        orderCart.push({ sku: product.sku, name: product.name, price: product.price, qty: 1, unit: product.unit });
    }
    renderOrderCart();
}

function renderOrderCart() {
    const container = document.getElementById('cartItems');
    if (orderCart.length === 0) {
        container.innerHTML = `<p class="empty-cart">Your order list is empty. Click "Add to Order" on any item.</p>`;
        document.getElementById('cartSubtotal').textContent = 'KES 0.00';
        document.getElementById('cartVat').textContent = 'KES 0.00';
        document.getElementById('cartTotal').textContent = 'KES 0.00';
        return;
    }

    container.innerHTML = '';
    let subtotal = 0;

    orderCart.forEach((item, index) => {
        const lineTotal = item.price * item.qty;
        subtotal += lineTotal;
        container.innerHTML += `
            <div class="cart-item-row">
                <div>
                    <strong>${item.name}</strong><br>
                    <small>KES ${item.price} x ${item.qty} ${item.unit}</small>
                </div>
                <div>
                    <span>KES ${lineTotal.toLocaleString()}</span>
                    <button onclick="removeFromCart(${index})" class="remove-btn">✕</button>
                </div>
            </div>
        `;
    });

    const vat = subtotal * 0.16;
    const total = subtotal + vat;

    document.getElementById('cartSubtotal').textContent = `KES ${subtotal.toLocaleString()}`;
    document.getElementById('cartVat').textContent = `KES ${vat.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    document.getElementById('cartTotal').textContent = `KES ${total.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

function removeFromCart(index) {
    orderCart.splice(index, 1);
    renderOrderCart();
}

function sendWhatsAppOrder() {
    if (orderCart.length === 0) {
        alert('Your order list is empty.');
        return;
    }

    let message = "Hello Luyali Hardware, I would like to place an order for the following items:\n\n";
    let subtotal = 0;

    orderCart.forEach((item, idx) => {
        let cost = item.price * item.qty;
        subtotal += cost;
        message += `${idx + 1}. ${item.name} - ${item.qty} ${item.unit} @ KES ${item.price} = KES ${cost}\n`;
    });

    let vat = subtotal * 0.16;
    let total = subtotal + vat;

    message += `\nSubtotal: KES ${subtotal.toLocaleString()}`;
    message += `\nVAT (16%): KES ${vat.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    message += `\n*Estimated Total: KES ${total.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}*`;
    message += `\nPlease confirm availability and delivery terms.`;

    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${globalSettings.phone}?text=${encoded}`;
    window.open(url, '_blank');
}

// ==========================================
// 2. OPERATOR DESK & POS CHECKOUT
// ==========================================
function populateOperatorDropdown() {
    const select = document.getElementById('posItemSelect');
    select.innerHTML = '';
    catalogProducts.forEach(p => {
        select.innerHTML += `<option value="${p.sku}">${p.name} (Stock: ${p.quantity} ${p.unit})</option>`;
    });
    updatePosItemDetails();
}

function updatePosItemDetails() {
    const sku = document.getElementById('posItemSelect').value;
    const product = catalogProducts.find(p => p.sku === sku);
    if (!product) return;

    document.getElementById('posInventoryHint').textContent = `Remaining Stock: ${product.quantity} ${product.unit} | Min Floor Price: KES ${product.min_price}`;
    document.getElementById('posPriceInput').value = product.price;
    calculatePosTotal();
}

function calculatePosTotal() {
    const sku = document.getElementById('posItemSelect').value;
    const product = catalogProducts.find(p => p.sku === sku);
    const qty = parseInt(document.getElementById('posQtyInput').value) || 0;
    const price = parseFloat(document.getElementById('posPriceInput').value) || 0;

    const warningBox = document.getElementById('priceWarning');
    if (product && price < product.min_price) {
        warningBox.textContent = `⚠️ Warning: Entered price is below the negotiable floor price (KES ${product.min_price})!`;
    } else {
        warningBox.textContent = '';
    }

    const subtotal = qty * price;
    const tax = subtotal * 0.16;
    const finalTotal = subtotal + tax;

    document.getElementById('posSubtotal').textContent = `KES ${subtotal.toLocaleString()}`;
    document.getElementById('posTax').textContent = `KES ${tax.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    document.getElementById('posFinalTotal').textContent = `KES ${finalTotal.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}

async function completeOperatorSale() {
    const operatorName = document.getElementById('operatorNameInput').value.trim() || 'Operator';
    const sku = document.getElementById('posItemSelect').value;
    const qtySold = parseInt(document.getElementById('posQtyInput').value) || 0;
    const agreedPrice = parseFloat(document.getElementById('posPriceInput').value) || 0;

    const product = catalogProducts.find(p => p.sku === sku);
    if (!product) return;

    if (qtySold > product.quantity) {
        alert(`Error: Insufficient stock. Only ${product.quantity} ${product.unit} remaining.`);
        return;
    }

    const newQuantity = product.quantity - qtySold;
    const totalPaid = (qtySold * agreedPrice) * 1.16; // including 16% VAT

    // Update product quantity in Supabase database
    const { error: updateError } = await _supabase
        .from('hardware_inventory')
        .update({ quantity: newQuantity })
        .eq('sku', sku);

    if (updateError) {
        alert('Failed to update stock in cloud: ' + updateError.message);
        return;
    }

    // Insert transaction report log into Supabase
    await _supabase.from('sales_reports').insert([{
        operator_name: operatorName,
        item_name: product.name,
        sku: product.sku,
        quantity_sold: qtySold,
        total_paid: totalPaid,
        tax_applied: totalPaid * 0.16
    }]);

    alert(`Sale Recorded Successfully!\nOperator: ${operatorName}\nItem: ${product.name}\nRemaining Stock: ${newQuantity} ${product.unit}`);
    
    // Refresh local cache and UI
    await fetchInventory();
    await fetchSalesLogs();
    populateOperatorDropdown();
    renderOperatorLowStock();
}

function renderOperatorLowStock() {
    const container = document.getElementById('operatorLowStockList');
    container.innerHTML = '';

    const lowStockItems = catalogProducts.filter(p => p.quantity <= p.threshold);
    if (lowStockItems.length === 0) {
        container.innerHTML = `<p class="ok-msg">All items are sufficiently stocked above thresholds.</p>`;
        return;
    }

    lowStockItems.forEach(item => {
        container.innerHTML += `
            <div class="mini-row">
                <span><strong>${item.name}</strong></span>
                <span class="badge low">Left: ${item.quantity} ${item.unit} (Limit: ${item.threshold})</span>
            </div>
        `;
    });
}

// ==========================================
// 3. ADMIN MANAGEMENT & REPORTS
// ==========================================
function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(`admin-tab-${tabName}`).classList.add('active');
    event.currentTarget.classList.add('active');

    if (tabName === 'stock') renderAdminStockTable();
    if (tabName === 'reports') renderReportsTables();
}

async function adminAddNewStock() {
    const name = document.getElementById('admName').value.trim();
    const sku = document.getElementById('admSku').value.trim();
    const category = document.getElementById('admCategory').value;
    const price = parseFloat(document.getElementById('admPrice').value);
    const min_price = parseFloat(document.getElementById('admMinPrice').value);
    const quantity = parseInt(document.getElementById('admQty').value);
    const threshold = parseInt(document.getElementById('admThreshold').value);
    const unit = document.getElementById('admUnit').value.trim();

    if (!name || !sku || isNaN(price) || isNaN(quantity)) {
        alert('Please fill out all mandatory stock fields correctly.');
        return;
    }

    const { error } = await _supabase.from('hardware_inventory').upsert([{
        sku, name, category, price, min_price, quantity, threshold, unit
    }], { onConflict: 'sku' });

    if (error) {
        alert('Error saving stock: ' + error.message);
    } else {
        alert('Stock uploaded and automatically synced to cloud database!');
        await fetchInventory();
        renderAdminStockTable();
    }
}

function renderAdminStockTable() {
    const tbody = document.getElementById('adminStockBody');
    tbody.innerHTML = '';

    catalogProducts.forEach(item => {
        const isLow = item.quantity <= item.threshold;
        tbody.innerHTML += `
            <tr>
                <td><code>${item.sku}</code></td>
                <td>${item.name}</td>
                <td>${item.category}</td>
                <td>KES ${item.price.toLocaleString()}</td>
                <td>KES ${item.min_price}</td>
                <td><strong>${item.quantity} ${item.unit}</strong></td>
                <td>${item.threshold}</td>
                <td><span class="badge ${isLow ? 'low' : 'ok'}">${isLow ? 'Low Stock Warning' : 'Stable'}</span></td>
            </tr>
        `;
    });
}

function renderReportsTables() {
    // Sales Report Table
    const salesBody = document.getElementById('salesReportBody');
    salesBody.innerHTML = '';
    salesLogs.forEach(s => {
        const dateStr = new Date(s.created_at).toLocaleString();
        salesBody.innerHTML += `
            <tr>
                <td>${dateStr}</td>
                <td><strong>${s.operator_name}</strong></td>
                <td>${s.item_name} (${s.sku})</td>
                <td>${s.quantity_sold}</td>
                <td>KES ${s.total_paid.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
            </tr>
        `;
    });

    // Low Stock Report Table (Items automatically removed when updates exceed threshold)
    const lowBody = document.getElementById('lowStockReportBody');
    lowBody.innerHTML = '';
    const lowItems = catalogProducts.filter(p => p.quantity <= p.threshold);
    
    if(lowItems.length === 0) {
        lowBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No items currently below threshold level.</td></tr>`;
        return;
    }

    lowItems.forEach(item => {
        lowBody.innerHTML += `
            <tr>
                <td><code>${item.sku}</code></td>
                <td>${item.name}</td>
                <td><strong style="color:var(--neon-magenta);">${item.quantity} ${item.unit}</strong></td>
                <td>${item.threshold}</td>
                <td>Restock Needed Immediately</td>
            </tr>
        `;
    });
}

async function saveSettings() {
    const phone = document.getElementById('settingPhone').value.trim();
    const email = document.getElementById('settingEmail').value.trim();

    const { error } = await _supabase.from('shop_settings').upsert([{ id: 1, phone, email }]);
    if (error) {
        alert('Error updating settings: ' + error.message);
    } else {
        globalSettings = { phone, email };
        alert('Global shop settings updated successfully!');
    }
}

// ==========================================
// REPORT EXPORT UTILITIES (.CSV & PRINT PDF)
// ==========================================
function exportReport(type) {
    if (type === 'print') {
        window.print();
        return;
    }

    if (type === 'csv') {
        let csvContent = "data:text/csv;charset=utf-8,Date,Operator,Item,SKU,QuantitySold,TotalPaidKES\n";
        salesLogs.forEach(s => {
            csvContent += `"${s.created_at}","${s.operator_name}","${s.item_name}","${s.sku}",${s.quantity_sold},${s.total_paid}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "luyali_hardware_sales_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}