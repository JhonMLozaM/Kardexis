import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ShoppingCart, Plus, Minus, X, CreditCard, Loader2, ScanLine, RotateCcw, Search, Camera, Wifi, WifiOff, Banknote, Smartphone, QrCode, ArrowRightLeft, Tag } from 'lucide-react';
import { api } from '../services/api';
import ScannerModal from '../components/ScannerModal';
import { db, getAllProducts, saveProducts, saveSaleOffline, getPendingSyncCount, type OfflineProduct } from '../services/offlineDb';
import { fullSync, startAutoSync, onSyncStatusChange } from '../services/syncWorker';
import { useAuthStore } from '../store/useAuthStore';
import { v4 as uuidv4 } from 'uuid';

// Ensure uuid is available
const generateId = () => {
  try { return uuidv4(); } catch { return `sale-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
};

type PaymentMethod = 'cash' | 'card' | 'transfer' | 'qr' | 'mixed';

interface CartItem {
  product: OfflineProduct;
  quantity: number;
  discount: number;
  iva_rate: number;
}

export default function POS() {
  const user = useAuthStore(s => s.user);
  const [products, setProducts] = useState<OfflineProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [syncPending, setSyncPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastInvoice, setLastInvoice] = useState<{ pdf: string, xml: string, pending?: boolean } | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [cardAmount, setCardAmount] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [qrAmount, setQrAmount] = useState<string>('');
  const [cartDiscount, setCartDiscount] = useState<number>(0);
  const [cartDiscountType, setCartDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [showDiscountInput, setShowDiscountInput] = useState(false);

  // Client State
  const [clientInfo, setClientInfo] = useState({
    client_id: '9999999999999',
    client_name: 'CONSUMIDOR FINAL',
    client_id_type: '05'
  });
  const [searchingClient, setSearchingClient] = useState(false);

  const resetClient = () => {
    setClientInfo({ client_id: '9999999999999', client_name: 'CONSUMIDOR FINAL', client_id_type: '05' });
  };

  const findClient = async () => {
    if (!clientInfo.client_id || clientInfo.client_id === '9999999999999') return;
    try {
      setSearchingClient(true);
      const resp = await api.get(`/customers/search/${clientInfo.client_id}`);
      setClientInfo({
        client_id: resp.data.dni_ruc,
        client_name: resp.data.name,
        client_id_type: resp.data.id_type || '05'
      });
    } catch { /* not found */ } finally { setSearchingClient(false); }
  };

  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initApp();
    const unsub = onSyncStatusChange((status, pending) => {
      setSyncPending(pending);
      setSyncing(status === 'syncing');
    });
    startAutoSync(30000);
    return () => { unsub(); };
  }, []);

  const initApp = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/products/');
      const apiProducts: OfflineProduct[] = resp.data.map((p: any) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        unit_of_measure: p.unit_of_measure,
        cost_price: p.cost_price,
        sale_price: p.sale_price,
        stock: p.stock || 0,
        min_stock_alert: p.min_stock_alert || 5,
        parent_product_id: p.parent_product_id,
        conversion_factor: p.conversion_factor,
        iva_rate: p.iva_rate ?? 15,
        synced_at: Date.now(),
      }));
      await saveProducts(apiProducts);
      setProducts(apiProducts);
      setIsOnline(true);
      fullSync().then(r => { if (r.sales_synced > 0) refreshSyncCount(); });
    } catch {
      setIsOnline(false);
      const local = await getAllProducts();
      setProducts(local);
    } finally { setLoading(false); }
    checkOnlineStatus();
  };

  const checkOnlineStatus = async () => {
    try { await api.get('/health', { timeout: 3000 }); setIsOnline(true); }
    catch { setIsOnline(false); }
  };

  const refreshSyncCount = async () => {
    const count = await getPendingSyncCount();
    setSyncPending(count);
  };

  const manualSync = async () => {
    setSyncing(true);
    try {
      const result = await fullSync();
      if (result.products > 0) {
        const local = await getAllProducts();
        setProducts(local);
      }
      await refreshSyncCount();
      if (result.sales_synced > 0) setSuccessMsg(`${result.sales_synced} ventas sincronizadas`);
    } finally { setSyncing(false); }
  };

  const visibleProducts = useMemo(() => {
    if (!barcodeInput) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(barcodeInput.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(barcodeInput.toLowerCase()))
    );
  }, [products, barcodeInput]);

  const addToCart = (product: OfflineProduct, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity + qty > product.stock) {
          setErrorMsg(`Stock insuficiente de ${product.name}`);
          setTimeout(() => setErrorMsg(''), 3000);
          return prev;
        }
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + qty } : item
        );
      }
      if (product.stock < qty) {
        setErrorMsg(`Stock insuficiente de ${product.name}`);
        setTimeout(() => setErrorMsg(''), 3000);
        return prev;
      }
      return [...prev, { product, quantity: qty, discount: 0, iva_rate: product.iva_rate ?? 15 }];
    });
    setSuccessMsg('');
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) { removeFromCart(productId); return; }
    const prod = products.find(p => p.id === productId);
    if (prod && newQty > prod.stock) {
      setErrorMsg(`Stock insuficiente de ${prod.name}`);
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    setCart(prev => prev.map(item =>
      item.product.id === productId ? { ...item, quantity: newQty } : item
    ));
  };

  const updateItemDiscount = (productId: string, discount: number) => {
    setCart(prev => prev.map(item =>
      item.product.id === productId ? { ...item, discount } : item
    ));
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;
    const matched = products.find(p => p.barcode === barcodeInput);
    if (matched) { addToCart(matched, 1); setBarcodeInput(''); }
  };

  // Calculations
  const subtotalBeforeDiscount = cart.reduce((acc, item) => acc + (item.product.sale_price * item.quantity), 0);
  const itemDiscounts = cart.reduce((acc, item) => acc + item.discount, 0);
  const discountAmount = cartDiscountType === 'percentage'
    ? (subtotalBeforeDiscount - itemDiscounts) * (cartDiscount / 100)
    : cartDiscount;
  const subtotal = Math.max(0, subtotalBeforeDiscount - itemDiscounts - discountAmount);

  // IVA por tasa (SRI 2026: 15% general)
  const calculateIVA = () => {
    const subtotalsByRate: Record<number, number> = {};
    cart.forEach(item => {
      const rate = item.iva_rate ?? 15;
      const itemSubtotal = (item.product.sale_price * item.quantity) - item.discount;
      subtotalsByRate[rate] = (subtotalsByRate[rate] || 0) + itemSubtotal;
    });

    let totalIVA = 0;
    const ivaBreakdown: Record<number, number> = {};

    Object.entries(subtotalsByRate).forEach(([rate, base]) => {
      const rateNum = parseInt(rate);
      const iva = Math.round(base * (rateNum / 100) * 100) / 100;
      ivaBreakdown[rateNum] = iva;
      totalIVA += iva;
    });

    return { totalIVA: Math.round(totalIVA * 100) / 100, ivaBreakdown };
  };

  const { totalIVA, ivaBreakdown } = calculateIVA();
  const total = Math.round((subtotal + totalIVA - cartDiscount) * 100) / 100;

  const totalPaid = useMemo(() => {
    if (paymentMethod === 'cash') return parseFloat(cashReceived) || 0;
    if (paymentMethod === 'card') return parseFloat(cardAmount) || 0;
    if (paymentMethod === 'transfer') return parseFloat(transferAmount) || 0;
    if (paymentMethod === 'qr') return parseFloat(qrAmount) || 0;
    if (paymentMethod === 'mixed') {
      return (parseFloat(cashReceived) || 0) + (parseFloat(cardAmount) || 0) + (parseFloat(transferAmount) || 0) + (parseFloat(qrAmount) || 0);
    }
    return 0;
  }, [paymentMethod, cashReceived, cardAmount, transferAmount, qrAmount]);

  const changeDue = useMemo(() => {
    if (paymentMethod === 'card' || paymentMethod === 'transfer' || paymentMethod === 'qr') return 0;
    return Math.max(0, totalPaid - total);
  }, [totalPaid, total, paymentMethod]);

  const canCheckout = useMemo(() => {
    if (cart.length === 0 || checkoutLoading) return false;
    if (paymentMethod === 'cash') return totalPaid >= total;
    return totalPaid >= total;
  }, [cart, totalPaid, total, checkoutLoading, paymentMethod]);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setLastInvoice(null);

    const externalId = generateId();
    const saleDate = new Date().toISOString();

    const payload = {
      external_id: externalId,
      ...clientInfo,
      items: cart.map(item => ({
        product_id: item.product.id,
        name: item.product.name,
        barcode: item.product.barcode,
        quantity: item.quantity,
        unit_price: item.product.sale_price,
        discount: item.discount,
      })),
      subtotal,
      tax: totalIVA,
      total,
      payment_method: paymentMethod,
      payment_details: paymentMethod === 'mixed' ? {
        cash: parseFloat(cashReceived) || 0,
        card: parseFloat(cardAmount) || 0,
        transfer: parseFloat(transferAmount) || 0,
        qr: parseFloat(qrAmount) || 0,
      } : undefined,
      discount: cartDiscount,
      discount_type: cartDiscountType,
      user_id: user?.id || '',
      date: saleDate,
    };

    try {
      if (isOnline) {
        const resp = await api.post('/sync/sale', payload);
        const pdfFile = resp.data.pdf_path?.split('/').pop();
        const xmlFile = resp.data.xml_path?.split('/').pop();
        setLastInvoice({
          pdf: pdfFile ? `/static/facturas/${pdfFile}` : '',
          xml: xmlFile ? `/static/facturas/${xmlFile}` : '',
        });
        setSuccessMsg('Venta y Factura generadas con exito!');
      } else {
        await saveSaleOffline({
          id: externalId,
          externalId,
          client_id: clientInfo.client_id,
          client_name: clientInfo.client_name,
          client_id_type: clientInfo.client_id_type,
          items: cart.map(item => ({
            product_id: item.product.id,
            name: item.product.name,
            barcode: item.product.barcode,
            quantity: item.quantity,
            unit_price: item.product.sale_price,
            discount: item.discount,
          })),
          subtotal,
          tax: totalIVA,
          total,
          payment_method: paymentMethod,
          payment_details: paymentMethod === 'mixed' ? {
            cash: parseFloat(cashReceived) || 0,
            card: parseFloat(cardAmount) || 0,
            transfer: parseFloat(transferAmount) || 0,
            qr: parseFloat(qrAmount) || 0,
          } : undefined,
          discount: cartDiscount,
          discount_type: cartDiscountType,
          user_id: user?.id || '',
          user_name: user?.full_name || '',
          date: saleDate,
        });
        setSuccessMsg('Venta registrada offline! Se sincronizara cuando haya conexion.');
        setLastInvoice({ pdf: '', xml: '', pending: true });
        refreshSyncCount();
      }

      // Update local stock
      for (const item of cart) {
        const idx = products.findIndex(p => p.id === item.product.id);
        if (idx >= 0) {
          const updated = [...products];
          updated[idx] = { ...updated[idx], stock: updated[idx].stock - item.quantity };
          setProducts(updated);
          await db.products.update(item.product.id, { stock: updated[idx].stock });
        }
      }

      setCart([]);
      setCashReceived('');
      setCardAmount('');
      setTransferAmount('');
      setQrAmount('');
      setCartDiscount(0);
      barcodeRef.current?.focus();

    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Error al procesar la venta.');
    } finally { setCheckoutLoading(false); }
  };

  const paymentIcons: Record<PaymentMethod, React.ReactNode> = {
    cash: <Banknote size={16} />,
    card: <CreditCard size={16} />,
    transfer: <ArrowRightLeft size={16} />,
    qr: <QrCode size={16} />,
    mixed: <Smartphone size={16} />,
  };

  return (
    <div className="anim-fade-in" style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', margin: '-24px', padding: 0 }}>
      <div className="pos-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '0.75rem', gap: '0.75rem' }}>

        {/* Left Panel: Catalog */}
        <section className="glass catalog-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', overflow: 'hidden' }}>
          {/* Sync Status Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--border-radius-sm)', backgroundColor: isOnline ? 'hsl(var(--success) / 0.1)' : 'hsl(var(--warning) / 0.1)', border: `1px solid ${isOnline ? 'hsl(var(--success) / 0.3)' : 'hsl(var(--warning) / 0.3)'}` }}>
            {isOnline ? <Wifi size={16} color="hsl(var(--success))" /> : <WifiOff size={16} color="hsl(var(--warning))" />}
            <span style={{ fontSize: '0.8rem', color: isOnline ? 'hsl(var(--success))' : 'hsl(var(--warning))', flex: 1 }}>
              {isOnline ? 'Online' : 'Offline - Ventas se guardaran localmente'}
            </span>
            {syncPending > 0 && (
              <button onClick={manualSync} disabled={syncing} className="btn glass" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {syncing ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightLeft size={12} />}
                {syncPending} pendiente{syncPending > 1 ? 's' : ''}
              </button>
            )}
          </div>

          <form onSubmit={handleBarcodeSubmit} style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <ScanLine style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--primary))' }} />
              <input
                ref={barcodeRef}
                type="text"
                placeholder="Escanea codigo de barras o busca por nombre..."
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                style={{ width: '100%', padding: '1rem 1rem 1rem 3.5rem', fontSize: '1.25rem', border: '2px solid hsl(var(--primary-light))' }}
                autoFocus
              />
            </div>
            <button type="button" onClick={() => setShowScanner(true)} className="btn hover-lift"
              style={{ padding: '0.75rem 1.25rem', background: 'hsl(var(--primary))', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--border-radius-md)', whiteSpace: 'nowrap' }}>
              <Camera size={22} /><span className="hide-on-mobile">Camara</span>
            </button>
          </form>

          <ScannerModal isOpen={showScanner} onClose={() => setShowScanner(false)} title="Escanear Producto"
            onScan={(code) => {
              const matched = products.find(p => p.barcode === code);
              if (matched) { addToCart(matched, 1); setSuccessMsg(`${matched.name} anadido`); setTimeout(() => setSuccessMsg(''), 2500); }
              else { setBarcodeInput(code); setErrorMsg(`Codigo "${code}" no encontrado`); setTimeout(() => setErrorMsg(''), 4000); }
            }}
          />

          {loading ? (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Loader2 className="animate-spin" size={40} color="hsl(var(--primary))" />
            </div>
          ) : (
            <div className="product-scroll-area" style={{ flex: 1, overflowY: 'auto', paddingBottom: '1rem' }}>
              <div className="product-grid-adaptive">
                {visibleProducts.map(p => (
                  <button key={p.id} className="btn glass hover-lift product-item-btn" onClick={() => addToCart(p)} disabled={p.stock <= 0}>
                    <div className="product-name-text">{p.name}</div>
                    <div className="product-info-row">
                      <span className="product-uom-tag">{p.unit_of_measure || 'Und'}</span>
                      <span className="product-price-badge">${p.sale_price.toFixed(2)}</span>
                      <span className="product-stock-badge" style={{ color: p.stock <= 0 ? 'hsl(var(--danger))' : 'hsl(var(--text-secondary))' }}>
                        {p.stock <= 0 ? 'Agotado' : `Stock: ${p.stock.toFixed(1)}`}
                      </span>
                    </div>
                  </button>
                ))}
                {visibleProducts.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-secondary))' }}>
                    No se encontraron productos.
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right Panel: Ticket */}
        <section className="glass" style={{ flex: '0 0 380px', display: 'flex', flexDirection: 'column', padding: '1.5rem', overflowY: 'auto' }}>
          <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            Ticket <span>{cart.reduce((a, b) => a + b.quantity, 0)} items</span>
          </h2>

          {/* Client */}
          <div className="glass" style={{ padding: '0.75rem', marginBottom: '1rem', backgroundColor: 'hsl(var(--primary) / 0.05)' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>CLIENTE</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" placeholder="RUC / Cedula" value={clientInfo.client_id}
                onChange={e => setClientInfo({ ...clientInfo, client_id: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), findClient())}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }} />
              <button onClick={findClient} className="btn glass" style={{ padding: '0.3rem 0.5rem' }} title="Buscar cliente" disabled={searchingClient}>
                {searchingClient ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </button>
              <button onClick={resetClient} className="btn glass" style={{ padding: '0.3rem' }} title="Resetear"><RotateCcw size={14} /></button>
            </div>
            <input type="text" placeholder="Nombre" value={clientInfo.client_name}
              onChange={e => setClientInfo({ ...clientInfo, client_name: e.target.value })}
              style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', marginTop: '0.4rem' }} />
          </div>

          {/* Cart Items */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', minHeight: '150px', border: '1px dashed var(--glass-border)', borderRadius: 'var(--border-radius-sm)', padding: '0.5rem' }}>
            {cart.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'hsl(var(--text-secondary))', flexDirection: 'column', gap: '0.5rem' }}>
                <ShoppingCart size={40} opacity={0.2} /><p style={{ fontSize: '0.85rem' }}>Carrito vacio</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {cart.map(item => (
                  <div key={item.product.id} style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-color)', padding: '0.6rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)', fontSize: '0.85rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.15rem' }}>{item.product.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))' }}>${item.product.sale_price.toFixed(2)} c/u</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                        <Tag size={10} />
                        <input type="number" step="0.01" min="0" placeholder="Dto"
                          value={item.discount || ''}
                          onChange={e => updateItemDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                          style={{ width: '50px', padding: '0.15rem', fontSize: '0.7rem', textAlign: 'center' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <button className="btn" style={{ padding: '0.2rem', borderRadius: '50%', background: 'transparent' }} onClick={() => updateQuantity(item.product.id, item.quantity - 1)}><Minus size={12} /></button>
                      <span style={{ width: '18px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.quantity}</span>
                      <button className="btn" style={{ padding: '0.2rem', borderRadius: '50%', background: 'hsl(var(--primary-light))' }} onClick={() => updateQuantity(item.product.id, item.quantity + 1)}><Plus size={12} color="hsl(var(--primary))" /></button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                      <button className="btn" style={{ padding: '0.15rem', background: 'transparent', color: 'hsl(var(--danger) / 0.7)' }} onClick={() => removeFromCart(item.product.id)}><X size={14} /></button>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>${((item.product.sale_price * item.quantity) - item.discount).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          {errorMsg && <div style={{ background: 'hsl(var(--danger) / 0.1)', color: 'hsl(var(--danger))', padding: '0.5rem', borderRadius: 'var(--border-radius-sm)', fontSize: '0.8rem', marginBottom: '0.75rem', textAlign: 'center' }}>{errorMsg}</div>}
          {successMsg && (
            <div style={{ background: 'hsl(var(--success) / 0.1)', color: 'hsl(var(--success))', padding: '0.5rem', borderRadius: 'var(--border-radius-sm)', fontSize: '0.8rem', marginBottom: '0.75rem', textAlign: 'center' }}>
              <div>{successMsg}</div>
              {lastInvoice && !lastInvoice.pending && lastInvoice.pdf && (
                <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a href={lastInvoice.pdf} target="_blank" rel="noreferrer" className="btn glass" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}>Ver PDF</a>
                  {lastInvoice.xml && <a href={lastInvoice.xml} target="_blank" rel="noreferrer" className="btn glass" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}>XML</a>}
                  <button onClick={() => {
                    // Usar iframe oculto para evitar popup blocker
                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = lastInvoice.pdf;
                    document.body.appendChild(iframe);
                    iframe.onload = () => {
                      iframe.contentWindow?.print();
                      setTimeout(() => iframe.remove(), 1000);
                    };
                  }} className="btn glass" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', color: 'hsl(var(--primary))' }}>Imprimir</button>
                </div>
              )}
              {lastInvoice?.pending && <div style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>Se sincronizara automaticamente</div>}
            </div>
          )}

          {/* Discount */}
          <div style={{ marginBottom: '0.75rem' }}>
            {showDiscountInput ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select value={cartDiscountType} onChange={e => setCartDiscountType(e.target.value as any)}
                  style={{ padding: '0.4rem', fontSize: '0.8rem' }}>
                  <option value="fixed">$ Fijo</option>
                  <option value="percentage">% Porcentaje</option>
                </select>
                <input type="number" step="0.01" min="0" value={cartDiscount || ''}
                  onChange={e => setCartDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="Descuento" style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }} />
                <button onClick={() => { setCartDiscount(0); setShowDiscountInput(false); }} className="btn glass" style={{ padding: '0.3rem' }}><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => setShowDiscountInput(true)} className="btn glass" style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'hsl(var(--primary))' }}>
                <Tag size={14} /> Agregar Descuento
              </button>
            )}
          </div>

          {/* Payment Method Selector */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            {(['cash', 'card', 'transfer', 'qr', 'mixed'] as PaymentMethod[]).map(method => (
              <button key={method} onClick={() => setPaymentMethod(method)}
                className="btn"
                style={{
                  flex: 1, minWidth: '60px', padding: '0.5rem 0.3rem', fontSize: '0.7rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
                  backgroundColor: paymentMethod === method ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                  border: `1px solid ${paymentMethod === method ? 'hsl(var(--primary))' : 'var(--glass-border)'}`,
                  color: paymentMethod === method ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
                }}>
                {paymentIcons[method]}
                {method === 'cash' ? 'Efectivo' : method === 'card' ? 'Tarjeta' : method === 'transfer' ? 'Transf.' : method === 'qr' ? 'QR' : 'Mixto'}
              </button>
            ))}
          </div>

          {/* Payment Inputs */}
          <div style={{ background: 'var(--glass-border)', padding: '1rem', borderRadius: 'var(--border-radius-md)', marginBottom: '1rem' }}>
            {(paymentMethod === 'cash' || paymentMethod === 'mixed') && (
              <div style={{ marginBottom: paymentMethod === 'mixed' ? '0.5rem' : 0 }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>EFECTIVO</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.5rem', fontWeight: 'bold', color: 'hsl(var(--text-secondary))' }}>$</span>
                  <input type="number" step="0.01" min="0" placeholder="0.00" value={cashReceived}
                    onChange={e => setCashReceived(e.target.value)}
                    style={{ padding: '0.5rem 0.5rem 0.5rem 1.5rem', fontSize: '1.1rem', fontWeight: 'bold', width: '100%' }} />
                </div>
              </div>
            )}
            {(paymentMethod === 'card' || paymentMethod === 'mixed') && (
              <div style={{ marginBottom: paymentMethod === 'mixed' ? '0.5rem' : 0 }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>TARJETA</label>
                <input type="number" step="0.01" min="0" placeholder="0.00" value={cardAmount}
                  onChange={e => setCardAmount(e.target.value)}
                  style={{ padding: '0.5rem', fontSize: '0.9rem', width: '100%' }} />
              </div>
            )}
            {(paymentMethod === 'transfer' || paymentMethod === 'mixed') && (
              <div style={{ marginBottom: paymentMethod === 'mixed' ? '0.5rem' : 0 }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>TRANSFERENCIA</label>
                <input type="number" step="0.01" min="0" placeholder="0.00" value={transferAmount}
                  onChange={e => setTransferAmount(e.target.value)}
                  style={{ padding: '0.5rem', fontSize: '0.9rem', width: '100%' }} />
              </div>
            )}
            {(paymentMethod === 'qr' || paymentMethod === 'mixed') && (
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>QR / DIGITAL</label>
                <input type="number" step="0.01" min="0" placeholder="0.00" value={qrAmount}
                  onChange={e => setQrAmount(e.target.value)}
                  style={{ padding: '0.5rem', fontSize: '0.9rem', width: '100%' }} />
              </div>
            )}
          </div>

          {/* Totals */}
          <div style={{ fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: 'hsl(var(--text-secondary))' }}>
              <span>Subtotal</span><span>${subtotalBeforeDiscount.toFixed(2)}</span>
            </div>
            {itemDiscounts > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: 'hsl(var(--danger))' }}>
                <span>Dcto. Items</span><span>-${itemDiscounts.toFixed(2)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: 'hsl(var(--danger))' }}>
                <span>Dcto. General</span><span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: 'hsl(var(--text-secondary))' }}>
              <span>IVA (15%)</span><span>${totalIVA.toFixed(2)}</span>
            </div>
            {paymentMethod === 'cash' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: 'hsl(var(--text-secondary))' }}>
                <span>Cambio</span><span style={{ color: 'hsl(var(--success))', fontWeight: 'bold' }}>${changeDue.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid hsl(var(--primary) / 0.2)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 600 }}>TOTAL</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'hsl(var(--primary))' }}>${total.toFixed(2)}</span>
            </div>
          </div>

          <button onClick={handleCheckout} disabled={!canCheckout} className="btn hover-lift"
            style={{ width: '100%', padding: '0.8rem', marginTop: '0.75rem', background: canCheckout ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary) / 0.5)', color: 'white', display: 'flex', justifyContent: 'center', gap: '0.5rem', fontSize: '1rem', cursor: canCheckout ? 'pointer' : 'not-allowed' }}>
            {checkoutLoading ? <Loader2 className="animate-spin" /> : <><CreditCard size={18} /> Cobrar</>}
          </button>
        </section>
      </div>
    </div>
  );
}
