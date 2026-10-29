:root {
    --bg-dark: #070a12;
    --panel-bg: rgba(16, 24, 43, 0.85);
    --neon-cyan: #00f3ff;
    --neon-magenta: #bc13fe;
    --neon-green: #00ff88;
    --text-main: #e2e8f0;
    --text-muted: #94a3b8;
}

*, *::before, *::after { box-sizing: border-box; }

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: var(--bg-dark);
    color: var(--text-main);
    margin: 0;
    padding: 0;
    min-height: 100vh;
}

.site-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(10, 14, 23, 0.95);
    border-bottom: 1px solid rgba(0, 243, 255, 0.25);
    padding: 14px 24px;
    flex-wrap: wrap;
    gap: 15px;
}

.brand { display: flex; align-items: center; gap: 12px; }
.brand h1 { margin: 0; font-size: 1.25rem; color: var(--neon-cyan); letter-spacing: 1px; }

.badge { font-size: 0.75rem; padding: 3px 8px; border-radius: 10px; font-weight: bold; }
.badge.online { background: rgba(0,255,136,0.15); color: var(--neon-green); border: 1px solid var(--neon-green); }
.badge.offline { background: rgba(255,85,85,0.15); color: #ff5555; border: 1px solid #ff5555; }
.badge.ok { background: rgba(0,255,136,0.1); color: var(--neon-green); }
.badge.low { background: rgba(188,19,254,0.15); color: var(--neon-magenta); border: 1px solid var(--neon-magenta); }

.role-selector { display: flex; gap: 8px; }
.role-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: var(--text-muted);
    padding: 7px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
}
.role-btn.active {
    background: var(--neon-cyan);
    color: var(--bg-dark);
    border-color: var(--neon-cyan);
    box-shadow: 0 0 12px rgba(0, 243, 255, 0.4);
}

.search-section {
    display: flex;
    gap: 12px;
    padding: 16px 24px;
    background: rgba(4, 8, 16, 0.6);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    flex-wrap: wrap;
}
.search-section input, .search-section select {
    padding: 10px 14px;
    background: #0c1527;
    border: 1px solid rgba(0, 243, 255, 0.2);
    color: #fff;
    border-radius: 6px;
    outline: none;
    font-size: 0.95rem;
}
.search-section input { flex-grow: 1; min-width: 240px; }

.main-container { padding: 24px; max-width: 1400px; margin: 0 auto; }
.app-view { display: none; }
.app-view.active { display: block; }

/* CATALOG & CART LAYOUT */
.catalog-layout { display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
.product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; align-content: start; }
.product-card {
    background: var(--panel-bg);
    border: 1px solid rgba(0, 243, 255, 0.15);
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    backdrop-filter: blur(10px);
}
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.sku-badge { font-family: monospace; font-size: 0.8rem; color: var(--text-muted); background: #040810; padding: 2px 6px; border-radius: 4px; }
.product-card h4 { margin: 4px 0; font-size: 1.1rem; color: #fff; }
.category-text { font-size: 0.85rem; color: var(--text-muted); margin: 0 0 10px 0; }
.price-box { font-size: 1.15rem; font-weight: bold; color: var(--neon-cyan); margin-bottom: 12px; }
.price-box small { font-size: 0.8rem; color: var(--text-muted); }

.cart-sidebar {
    background: var(--panel-bg);
    border: 1px solid rgba(188, 19, 254, 0.3);
    border-radius: 10px;
    padding: 18px;
    height: fit-content;
    position: sticky;
    top: 20px;
}
.cart-sidebar h3 { margin-top: 0; color: #e580ff; font-size: 1.1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; }
.cart-items-box { max-height: 250px; overflow-y: auto; margin-bottom: 12px; }
.empty-cart { color: var(--text-muted); font-size: 0.9rem; text-align: center; }
.cart-item-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.08); padding: 8px 0; font-size: 0.9rem; }
.remove-btn { background: none; border: none; color: #ff5555; cursor: pointer; font-weight: bold; padding: 2px 6px; }
.cart-summary { border-top: 1px solid rgba(255,255,255,0.15); padding-top: 10px; font-size: 0.9rem; }
.cart-summary p { margin: 4px 0; display: flex; justify-content: space-between; }
.total-row { font-weight: bold; color: var(--neon-cyan); font-size: 1.05rem; margin-top: 6px !important; }

/* OPERATOR DESK */
.operator-layout { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; }
.pos-panel, .quick-stock-panel, .admin-card {
    background: var(--panel-bg);
    border: 1px solid rgba(0, 243, 255, 0.2);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
}
.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 0.9rem; margin-bottom: 6px; color: var(--text-muted); }
.form-group input, .form-group select { width: 100%; padding: 10px; background: #0c1527; border: 1px solid rgba(255,255,255,0.15); color: #fff; border-radius: 6px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.inventory-hint { font-size: 0.85rem; color: var(--neon-green); font-family: monospace; margin-bottom: 12px; }
.warning-text { color: #ff5555; font-size: 0.85rem; margin-bottom: 10px; font-weight: bold; }
.checkout-summary-box { background: rgba(4,8,16,0.6); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 0.95rem; }
.checkout-summary-box p { margin: 4px 0; display: flex; justify-content: space-between; }

.mini-list { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
.mini-row { display: flex; justify-content: space-between; align-items: center; background: rgba(4,8,16,0.5); padding: 8px 12px; border-radius: 6px; font-size: 0.9rem; }

/* ADMIN TABS & TABLES */
.admin-tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
.tab-btn { background: #0c1527; border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: bold; }
.tab-btn.active { background: var(--neon-magenta); color: #fff; border-color: var(--neon-magenta); box-shadow: 0 0 12px rgba(188,19,254,0.4); }
.admin-tab-content { display: none; }
.admin-tab-content.active { display: block; }

.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 14px; }
.form-grid input, .form-grid select { padding: 10px; background: #0c1527; border: 1px solid rgba(255,255,255,0.15); color: #fff; border-radius: 6px; }

.table-responsive { width: 100%; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; }
th, td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); }
th { color: var(--neon-cyan); background: rgba(4,8,16,0.4); font-family: monospace; }

.reports-toolbar { display: flex; gap: 12px; margin-bottom: 16px; }

.action-btn {
    background: linear-gradient(135deg, #00f3ff 0%, #0088cc 100%);
    color: #070a12;
    border: none;
    padding: 11px 18px;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    text-transform: uppercase;
    font-size: 0.85rem;
    letter-spacing: 0.5px;
    width: 100%;
    transition: opacity 0.2s;
}
.action-btn:hover { opacity: 0.9; }
.action-btn.secondary { background: linear-gradient(135deg, #bc13fe 0%, #7000aa 100%); color: #fff; }
.action-btn.success-btn { background: linear-gradient(135deg, #00ff88 0%, #00aa55 100%); color: #070a12; }
.whatsapp-btn { background: #25D366 !important; color: #fff !important; margin-top: 12px; }

@media (max-width: 900px) {
    .catalog-layout, .operator-layout { grid-template-columns: 1fr; }
    .cart-sidebar { position: static; }
}