import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ShoppingCart, Plus, Minus, X, CreditCard, ArrowLeft, Loader2, ScanLine, RotateCcw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface CartItem {
  product: any;
  quantity: number;
}

export default function POS() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastInvoice, setLastInvoice] = useState<{ pdf: string, xml: string } | null>(null);
  const [cashReceived, setCashReceived] = useState<string>('');

  // Client State
  const [clientInfo, setClientInfo] = useState({
    client_id: '9999999999999',
    client_name: 'CONSUMIDOR FINAL',
    client_id_type: '05'
  });
  const [searchingClient, setSearchingClient] = useState(false);
  const [isSrigenerated, setIsSrigenerated] = useState(false);

  const resetClient = () => {
    setClientInfo({
      client_id: '9999999999999',
      client_name: 'CONSUMIDOR FINAL',
      client_id_type: '05'
    });
    setIsSrigenerated(false);
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
      // Si el email está vacío, asumimos que viene del catálogo SRI y no del CRM propio
      setIsSrigenerated(!resp.data.email);
    } catch (err) {
      console.log("Cliente no encontrado en CRM ni SRI");
    } finally {
      setSearchingClient(false);
    }
  };

  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    // Enfoque inteligente: Solo enfocar si es escritorio y no se está editando otro campo
    const timer = setInterval(() => {
        if (window.innerWidth < 768) return; // No auto-enfocar en móviles para evitar el teclado virtual
        const activeEl = document.activeElement;
        const isEditingOther = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT') && activeEl !== barcodeRef.current;
        if (!isEditingOther) {
            barcodeRef.current?.focus();
        }
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/products/');
      setProducts(resp.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const visibleProducts = useMemo(() => {
    if (!barcodeInput) return products;
    return products.filter(p => 
      p.name.toLowerCase().includes(barcodeInput.toLowerCase()) || 
      (p.barcode && p.barcode.toLowerCase().includes(barcodeInput.toLowerCase()))
    );
  }, [products, barcodeInput]);

  const addToCart = (product: any, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product._id === product._id);
      if (existing) {
        // Prevent adding if out of stock
        if (existing.quantity + qty > product.stock) {
            setErrorMsg(`Stock insuficiente de ${product.name}`);
            setTimeout(() => setErrorMsg(''), 3000);
            return prev;
        }
        return prev.map(item => 
          item.product._id === product._id 
            ? { ...item, quantity: item.quantity + qty } 
            : item
        );
      }
      
      if (product.stock < qty) {
          setErrorMsg(`Stock insuficiente de ${product.name}`);
          setTimeout(() => setErrorMsg(''), 3000);
          return prev;
      }
      
      return [...prev, { product, quantity: qty }];
    });
    setSuccessMsg('');
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product._id !== productId));
  };

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    
    const prod = products.find(p => p._id === productId);
    if (prod && newQty > prod.stock) {
        setErrorMsg(`Stock insuficiente de ${prod.name}`);
        setTimeout(() => setErrorMsg(''), 3000);
        return;
    }

    setCart(prev => prev.map(item => 
      item.product._id === productId ? { ...item, quantity: newQty } : item
    ));
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;

    const matchedProduct = products.find(p => p.barcode === barcodeInput);
    if (matchedProduct) {
      addToCart(matchedProduct, 1);
      setBarcodeInput('');
    } else {
        // Did not match an exact barcode. Leave it so user can click manually.
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    setLastInvoice(null);

    try {
      const payload = {
        ...clientInfo,
        items: cart.map(item => ({
          product_id: item.product._id,
          name: item.product.name,
          barcode: item.product.barcode,
          quantity: item.quantity,
          unit_price: item.product.sale_price
        })),
        subtotal: subtotal,
        tax: 0, 
        total: subtotal
      };

      const resp = await api.post('/sales/', payload);
      
      const serverUrl = `http://${window.location.hostname}:8000`;
      
      // Ajustamos la ruta para que coincida con el punto de montaje estático del servidor
      const pdfFile = resp.data.pdf_path.split('/').pop();
      const xmlFile = resp.data.xml_path.split('/').pop();

      setLastInvoice({
        pdf: `${serverUrl}/static/facturas/${pdfFile}`,
        xml: `${serverUrl}/static/facturas/${xmlFile}`
      });

      setSuccessMsg('¡Venta y Factura generadas con éxito!');
      setCart([]);
      setCashReceived('');
      fetchProducts(); // Refresh stocks
      barcodeRef.current?.focus();

    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Error al procesar la venta y factura.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Cálculos Toánicos
  const subtotal = cart.reduce((acc, item) => acc + (item.product.sale_price * item.quantity), 0);
  const changeDue = useMemo(() => {
    const received = parseFloat(cashReceived) || 0;
    return Math.max(0, received - subtotal);
  }, [cashReceived, subtotal]);

  const canCheckout = useMemo(() => {
    const received = parseFloat(cashReceived) || 0;
    return cart.length > 0 && received >= subtotal && !checkoutLoading;
  }, [cart, cashReceived, subtotal, checkoutLoading]);
  
  return (
    <div className="app-container anim-fade-in" style={{ padding: '0', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ShoppingCart size={28} color="hsl(var(--primary))" />
            <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Caja / POS</h1>
          </div>
          <button onClick={() => navigate('/')} className="btn glass hover-lift" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid hsl(var(--primary-light))', color: 'hsl(var(--primary))' }}>
            <ArrowLeft size={18} /> <span>Menú</span>
          </button>
        </div>
      </header>

      <main className="pos-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '1rem', gap: '1rem' }}>
        
        {/* Panel Izquierdo: Catálogo y Escáner */}
        <section className="glass catalog-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', overflow: 'hidden' }}>
          
          <form onSubmit={handleBarcodeSubmit} style={{ marginBottom: '1.5rem', position: 'relative' }}>
            <ScanLine style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--primary))' }} />
            <input 
              ref={barcodeRef}
              type="text" 
              placeholder="Escanea el código de barras aquí o busca por nombre..." 
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              style={{ width: '100%', padding: '1rem 1rem 1rem 3.5rem', fontSize: '1.25rem', border: '2px solid hsl(var(--primary-light))' }}
              autoFocus
            />
          </form>

          {loading ? (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Loader2 className="animate-spin" size={40} color="hsl(var(--primary))"/>
            </div>
          ) : (
            <div className="product-scroll-area" style={{ flex: 1, overflowY: 'auto', paddingBottom: '1rem' }}>
              <div className="product-grid-adaptive">
                {visibleProducts.map(p => (
                  <button 
                    key={p._id} 
                    className="btn glass hover-lift product-item-btn" 
                    onClick={() => addToCart(p)}
                    disabled={p.stock <= 0}
                  >
                      <div className="product-name-text">
                          {p.name}
                      </div>
                      <div className="product-info-row">
                          <span className="product-uom-tag">{p.unit_of_measure || 'Und'}</span>
                          <span className="product-price-badge">${p.sale_price.toFixed(2)}</span>
                          <span className="product-stock-badge" style={{ color: p.stock <= 0 ? 'hsl(var(--danger))' : 'hsl(var(--text-secondary))' }}>
                              {p.stock <= 0 ? '🚫' : `📦 ${p.stock.toFixed(1)}`}
                          </span>
                      </div>
                  </button>
                ))}
                {visibleProducts.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'hsl(var(--text-secondary))' }}>
                        No se encontraron productos coincidentes.
                    </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Panel Derecho: Ticket de Caja */}
        <section className="glass" style={{ flex: '0 0 380px', display: 'flex', flexDirection: 'column', padding: '1.5rem', position: 'relative' }}>
          <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            A Pagar <span>{cart.reduce((a, b) => a + b.quantity, 0)} items</span>
          </h2>

          <div className="glass" style={{ padding: '1rem', marginBottom: '1rem', background: 'hsl(var(--primary) / 0.05)' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              DATOS DEL CLIENTE
              {isSrigenerated && <span style={{ color: 'hsl(var(--warning))', fontSize: '0.65rem' }}>✨ Sugerido SRI</span>}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="RUC / Cédula" 
                  value={clientInfo.client_id}
                  onChange={e => setClientInfo({...clientInfo, client_id: e.target.value})}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), findClient())}
                  style={{ padding: '0.5rem 2.5rem 0.5rem 0.5rem', fontSize: '0.8rem', width: '100%' }}
                />
                <button 
                  type="button" 
                  onClick={findClient}
                  disabled={searchingClient}
                  className="btn hover-lift" 
                  style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', padding: '0.3rem', border: 'none', background: 'transparent', color: 'hsl(var(--primary))' }}
                >
                  {searchingClient ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
              </div>
              <select 
                value={clientInfo.client_id_type}
                onChange={e => setClientInfo({...clientInfo, client_id_type: e.target.value})}
                style={{ padding: '0.5rem', fontSize: '0.8rem', background: 'var(--bg-color)', border: '1px solid var(--glass-border)', borderRadius: 'var(--border-radius-sm)' }}
              >
                <option value="05">Cédula</option>
                <option value="04">RUC</option>
                <option value="06">Pasaporte</option>
              </select>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  placeholder="Nombre / Razón Social" 
                  value={clientInfo.client_name}
                  onChange={e => setClientInfo({...clientInfo, client_name: e.target.value})}
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                />
                <button onClick={resetClient} className="btn glass" style={{ padding: '0.4rem', color: 'hsl(var(--text-secondary))' }} title="Resetear a Consumidor Final">
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
            {cart.length === 0 ? (
               <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'hsl(var(--text-secondary))', flexDirection: 'column', gap: '1rem' }}>
                   <ShoppingCart size={48} opacity={0.2} />
                   <p>El carrito está vacío</p>
               </div>
            ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                   {cart.map(item => (
                     <div key={item.product._id} style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-color)', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{item.product.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'hsl(var(--primary))', fontWeight: 'bold' }}>${item.product.sale_price.toFixed(2)} c/u</div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--glass-bg)', borderRadius: '20px', padding: '0.25rem' }}>
                            <button className="btn" style={{ padding: '0.25rem', borderRadius: '50%', background: 'transparent' }} onClick={() => updateQuantity(item.product._id, item.quantity - 1)}>
                                <Minus size={14} />
                            </button>
                            <span style={{ width: '20px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</span>
                            <button className="btn" style={{ padding: '0.25rem', borderRadius: '50%', background: 'hsl(var(--primary-light))' }} onClick={() => updateQuantity(item.product._id, item.quantity + 1)}>
                                <Plus size={14} color="hsl(var(--primary))"/>
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: '0.5rem' }}>
                            <button className="btn" style={{ padding: '0.2rem', background: 'transparent', color: 'hsl(var(--danger) / 0.7)' }} onClick={() => removeFromCart(item.product._id)}>
                                <X size={16} />
                            </button>
                            <span style={{ fontWeight: 800 }}>${(item.product.sale_price * item.quantity).toFixed(2)}</span>
                        </div>
                     </div>
                   ))}
               </div>
            )}
          </div>

          {errorMsg && <div style={{ background: 'hsl(var(--danger) / 0.1)', color: 'hsl(var(--danger))', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>{errorMsg}</div>}
          {successMsg && (
            <div style={{ background: 'hsl(var(--success) / 0.1)', color: 'hsl(var(--success))', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>
              <div>{successMsg}</div>
              {lastInvoice && (
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  <a href={lastInvoice.pdf} target="_blank" rel="noreferrer" className="btn glass" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'hsl(var(--success))' }}>Descargar PDF</a>
                  <a href={lastInvoice.xml} target="_blank" rel="noreferrer" className="btn glass" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'hsl(var(--success))' }}>Ver XML</a>
                </div>
              )}
            </div>
          )}

          <div style={{ background: 'var(--glass-border)', padding: '1.25rem', borderRadius: 'var(--border-radius-lg)', marginTop: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'hsl(var(--text-secondary))' }}>
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
            </div>
            {/* Impuestos placeholder */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: 'hsl(var(--text-secondary))' }}>
                <span>Cargos Adicionales</span>
                <span>$0.00</span>
            </div>

            {/* Sección de Cambio */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
                <div className="glass" style={{ padding: '0.75rem', border: '1px solid hsl(var(--primary) / 0.3)' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem', color: 'hsl(var(--primary))' }}>DINERO RECIBIDO</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: '0.5rem', fontWeight: 'bold', color: 'hsl(var(--text-secondary))' }}>$</span>
                        <input 
                            type="number" 
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={cashReceived}
                            onChange={e => setCashReceived(e.target.value)}
                            style={{ padding: '0.5rem 0.5rem 0.5rem 1.5rem', fontSize: '1.2rem', fontWeight: 'bold', width: '100%', background: 'transparent' }}
                        />
                    </div>
                </div>
                <div className="glass" style={{ padding: '0.75rem', border: `1px solid ${parseFloat(cashReceived) >= subtotal ? 'hsl(var(--success) / 0.3)' : 'var(--glass-border)'}` }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 'bold', display: 'block', marginBottom: '0.4rem', color: 'hsl(var(--text-secondary))' }}>SU CAMBIO</label>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: parseFloat(cashReceived) >= subtotal ? 'hsl(var(--success))' : 'hsl(var(--text-secondary))' }}>
                        ${changeDue.toFixed(2)}
                    </div>
                </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderTop: '2px solid hsl(var(--primary) / 0.2)', paddingTop: '1rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>Total a Pagar</span>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'hsl(var(--primary))' }}>${subtotal.toFixed(2)}</span>
            </div>

            <button 
                onClick={handleCheckout} 
                disabled={!canCheckout}
                className="btn hover-lift" 
                style={{ width: '100%', padding: '1rem', background: canCheckout ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary) / 0.5)', color: 'white', display: 'flex', justifyContent: 'center', gap: '0.5rem', fontSize: '1.1rem', cursor: canCheckout ? 'pointer' : 'not-allowed' }}
            >
                {checkoutLoading ? <Loader2 className="animate-spin" /> : (
                    <>
                        <CreditCard size={20} /> Cobrar e Imprimir
                    </>
                )}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
