import React, { useEffect, useState, useRef } from 'react';
import { Package, Plus, X, Search, Filter, Loader2, Beaker, CheckCircle, Tag, Printer, Camera } from 'lucide-react';
import Barcode from 'react-barcode';
import { api } from '../services/api';
import ScannerModal from '../components/ScannerModal';

export default function Products() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [isFractioned, setIsFractioned] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Fraction Modal State
  const [showFractionModal, setShowFractionModal] = useState(false);
  const [fractionLoading, setFractionLoading] = useState(false);
  const [fractionError, setFractionError] = useState('');
  const [fractionSuccess, setFractionSuccess] = useState('');
  const [fractionData, setFractionData] = useState({ product_id: '', quantity: '' });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  // Label Modal State
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [labelLoading, setLabelLoading] = useState(false);

  // Stock Entry Modal State
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState('');
  const [entrySuccess, setEntrySuccess] = useState('');
  const [entryData, setEntryData] = useState({ quantity: '', notes: '' });
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // Form State
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    unit_of_measure: '',
    cost_price: '',
    sale_price: '',
    stock: '',
    min_stock_alert: '',
    parent_product_id: '',
    conversion_factor: ''
  });

  useEffect(() => {
    fetchProducts();
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

  const parentProducts = products.filter(p => !p.parent_product_id);
  const childProducts = products.filter(p => p.parent_product_id);

  const filteredProducts = products.filter(p => {
    // Búsqueda por nombre o código de barras
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;
    
    // Filtros por estado o jerarquía
    if (filterType === 'PARENT') return !p.parent_product_id;
    if (filterType === 'CHILD') return !!p.parent_product_id;
    if (filterType === 'LOW_STOCK') return p.stock <= p.min_stock_alert;
    
    return true;
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Evita que un escáner haga 'submit' automático indeseado
      // Mover el foco al siguiente input lógicamente (opcional, simulamos tab)
      const form = e.currentTarget.form;
      if (form) {
        const index = Array.prototype.indexOf.call(form, e.currentTarget);
        (form.elements[index + 1] as HTMLElement)?.focus();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg('');

    try {
      const payload: any = {
        name: formData.name,
        barcode: formData.barcode || null,
        unit_of_measure: formData.unit_of_measure,
        cost_price: parseFloat(formData.cost_price),
        sale_price: parseFloat(formData.sale_price),
        min_stock_alert: parseFloat(formData.min_stock_alert)
      };

      if (isFractioned) {
        payload.stock = 0; // Un hijo nace con 0
        payload.parent_product_id = formData.parent_product_id;
        payload.conversion_factor = parseFloat(formData.conversion_factor);
      } else {
        payload.stock = parseFloat(formData.stock);
      }

      await api.post('/products/', payload);
      setShowModal(false);
      resetForm();
      fetchProducts(); // Refresh list
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Error al guardar el producto");
    } finally {
      setFormLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', barcode: '', unit_of_measure: '', cost_price: '', sale_price: '',
      stock: '', min_stock_alert: '', parent_product_id: '', conversion_factor: ''
    });
    setIsFractioned(false);
    setErrorMsg('');
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
    // Autofocus en el input para lectura de Escáner Inmediato
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 100);
  };

  const handleFractionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFractionLoading(true);
    setFractionError('');
    setFractionSuccess('');

    try {
      const payload = {
        product_id: fractionData.product_id,
        transaction_type: "TRANSFORMATION",
        quantity: parseFloat(fractionData.quantity)
      };
      
      await api.post('/kardex/', payload);
      setFractionSuccess(`¡Stock fraccionado exitosamente! Las cantidades se actualizaron.`);
      fetchProducts(); // Refrescar stock de padres e hijos al instante
      
      // Auto-cerrar después de 2 segundos de éxito
      setTimeout(() => {
         setShowFractionModal(false);
         setFractionSuccess('');
         setFractionData({ product_id: '', quantity: '' });
      }, 2500);

    } catch (err: any) {
      let errorStr = "Error al procesar el fraccionamiento en el Backend.";
      if (err.response?.data?.detail) {
          if (typeof err.response.data.detail === "string") {
              errorStr = err.response.data.detail;
          } else {
              errorStr = JSON.stringify(err.response.data.detail);
          }
      }
      setFractionError(errorStr);
    } finally {
      setFractionLoading(false);
    }
  };

  const handleGenerateLabel = async (product: any) => {
    setSelectedProduct(product);
    setShowLabelModal(true);
    
    // Si no tiene código, generarlo automáticamente
    if (!product.barcode) {
      setLabelLoading(true);
      try {
        const resp = await api.post(`/products/${product.id}/generate-barcode`);
        const updatedBarcode = resp.data.barcode;
        
        // Actualizar el estado local para que se vea de una vez
        setProducts(prev => prev.map(p => 
          p.id === product.id ? { ...p, barcode: updatedBarcode } : p
        ));
        setSelectedProduct({ ...product, barcode: updatedBarcode });
      } catch (err) {
        console.error("Error al generar código automático", err);
      } finally {
        setLabelLoading(false);
      }
    }
  };

  const openEntryModal = (product: any) => {
    setSelectedProduct(product);
    setEntryData({ quantity: '', notes: '' });
    setEntryError('');
    setEntrySuccess('');
    setShowEntryModal(true);
  };

  const handleEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    
    setEntryLoading(true);
    setEntryError('');
    setEntrySuccess('');

    try {
      const payload = {
        product_id: selectedProduct.id,
        transaction_type: "IN",
        quantity: parseFloat(entryData.quantity),
        notes: entryData.notes
      };
      
      await api.post('/kardex/', payload);
      setEntrySuccess(`¡Stock ingresado correctamente para ${selectedProduct.name}!`);
      fetchProducts(); // Refrescar lista para ver stock actualizado
      
      setTimeout(() => {
        setShowEntryModal(false);
        setEntrySuccess('');
      }, 2000);
    } catch (err: any) {
      setEntryError(err.response?.data?.detail || "Error al registrar la entrada de stock");
    } finally {
      setEntryLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="anim-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Package size={22} color="hsl(var(--primary))" /> Inventario
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setShowFractionModal(true)} className="btn hover-lift" style={{ background: 'hsl(var(--secondary) / 0.1)', color: 'hsl(var(--secondary))', border: '1px solid hsl(var(--secondary) / 0.3)' }}>
            <Beaker size={16} /> Fraccionar
          </button>
          <button onClick={openModal} className="btn btn-primary hover-lift">
            <Plus size={16} /> Nuevo Producto
          </button>
        </div>
      </div>
        <div className="glass" style={{ minHeight: '60vh', padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))' }} />
              <input 
                type="text" 
                placeholder="Buscar por código, nombre..." 
                style={{ width: '100%', paddingLeft: '3rem' }} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div style={{ position: 'relative', flex: '0 1 200px' }}>
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'hsl(var(--text-secondary))' }}>
                <Filter size={18} />
              </div>
              <select 
                className="btn glass" 
                style={{ width: '100%', paddingLeft: '2.5rem', appearance: 'none', border: '1px solid var(--glass-border)', cursor: 'pointer', outline: 'none' }}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="ALL">Todos los Productos</option>
                <option value="PARENT">Originales (Padres)</option>
                <option value="CHILD">Fraccionados (Hijos)</option>
                <option value="LOW_STOCK">Stock Bajo (Crítico)</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><Loader2 className="animate-spin" size={40} color="hsl(var(--primary))"/></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'hsl(var(--text-secondary))' }}>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>CÓDIGO</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>PRODUCTO</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>MEDIDA</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>PRECIO</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>STOCK</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>TIPO</th>
                    <th style={{ padding: '1rem', fontWeight: 600 }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--glass-border)' }} className="hover-lift">
                      <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{p.barcode || <span style={{ fontStyle: 'italic', color: 'hsl(var(--text-secondary))', fontSize: '0.8rem' }}>Sin código</span>}</td>
                      <td style={{ padding: '1rem', fontWeight: 500 }}>{p.name}</td>
                      <td style={{ padding: '1rem' }}><span style={{ background: 'hsl(var(--primary-light))', color: 'hsl(var(--primary))', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase'}}>{p.unit_of_measure}</span></td>
                      <td style={{ padding: '1rem' }}>${p.sale_price.toFixed(2)}</td>
                      <td style={{ padding: '1rem', fontWeight: 'bold', color: p.stock <= p.min_stock_alert ? 'hsl(var(--danger))' : 'inherit' }}>{p.stock.toFixed(2)}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ fontSize: '0.875rem', color: 'hsl(var(--text-secondary))' }}>
                          {p.parent_product_id ? 'Fraccionado' : 'Original (Padre)'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            onClick={() => openEntryModal(p)} 
                            className="btn glass hover-lift" 
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: 'hsl(var(--success))', borderColor: 'hsl(var(--success) / 0.3)' }}
                            title="Ingresar Stock (Entrada)"
                          >
                            <Plus size={14} style={{ marginRight: '0.25rem' }} /> Entrada
                          </button>
                          <button 
                            onClick={() => handleGenerateLabel(p)} 
                            className="btn glass hover-lift" 
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: 'hsl(var(--primary))', borderColor: 'hsl(var(--primary) / 0.3)' }}
                            title="Generar Etiqueta"
                          >
                            <Tag size={14} style={{ marginRight: '0.25rem' }} /> Etiqueta
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {/* Modal Glassmorphism form */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} className="anim-fade-in">
          <div className="glass" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setShowModal(false)} className="btn" style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', padding: '0.5rem' }}>
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1.5rem' }}><Package style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}/> Crear Producto</h2>
            
            {errorMsg && (
               <div style={{ background: 'hsl(var(--danger) / 0.1)', color: 'hsl(var(--danger))', padding: '1rem', marginBottom: '1rem', borderRadius: 'var(--border-radius-sm)', fontSize: '0.875rem' }}>
                 {errorMsg}
               </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'var(--glass-border)', padding: '0.5rem', borderRadius: 'var(--border-radius-sm)' }}>
              <button 
                type="button"
                className={`btn ${!isFractioned ? 'btn-primary' : 'glass'}`} 
                style={{ flex: 1 }} 
                onClick={() => setIsFractioned(false)}
              >
                Producto Original (Padre)
              </button>
              <button 
                type="button"
                className={`btn ${isFractioned ? 'btn-primary' : 'glass'}`} 
                style={{ flex: 1 }} 
                onClick={() => setIsFractioned(true)}
              >
                Fraccionado (Hijo)
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Nombre del Producto</label>
                <input required name="name" value={formData.name} onChange={handleInputChange} type="text" placeholder="Ej. Harina de Trigo Premium" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'hsl(var(--primary))' }}>Código de Barras (Escáner)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input ref={barcodeInputRef} name="barcode" value={formData.barcode} onChange={handleInputChange} onKeyDown={handleKeyDown} type="text" placeholder="Apunta el láser aquí" style={{ flex: 1 }} />
                  <button 
                    type="button" 
                    onClick={() => setShowBarcodeScanner(true)}
                    className="btn hover-lift"
                    style={{ 
                      padding: '0.5rem 0.75rem', 
                      background: 'hsl(var(--primary))', 
                      color: 'white', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.25rem',
                      borderRadius: 'var(--border-radius-sm)'
                    }}
                    title="Escanear con la cámara"
                  >
                    <Camera size={18} />
                  </button>
                </div>
              </div>

              <ScannerModal
                isOpen={showBarcodeScanner}
                onClose={() => setShowBarcodeScanner(false)}
                title="Escanear Código de Barras"
                onScan={(code) => {
                  setFormData(prev => ({ ...prev, barcode: code }));
                }}
              />

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Unidad de Medida</label>
                <input required name="unit_of_measure" value={formData.unit_of_measure} onChange={handleInputChange} type="text" placeholder="Ej. Quintal, Libra, Litro" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Precio de Costo ($)</label>
                <input required name="cost_price" value={formData.cost_price} onChange={handleInputChange} type="number" step="0.01" min="0" placeholder="0.00" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Precio de Venta ($)</label>
                <input required name="sale_price" value={formData.sale_price} onChange={handleInputChange} type="number" step="0.01" min="0" placeholder="0.00" />
              </div>

              {isFractioned ? (
                <>
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'hsl(var(--primary))' }}>Selecciona el Producto Padre de donde se extraerá</label>
                    <select required name="parent_product_id" value={formData.parent_product_id} onChange={handleInputChange} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-color)', border: '1px solid var(--glass-border)' }}>
                      <option value="">Selecciona un producto...</option>
                      {parentProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.unit_of_measure}) - Stock: {p.stock}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Factor de Conversión</label>
                    <input required name="conversion_factor" value={formData.conversion_factor} onChange={handleInputChange} type="number" step="0.01" min="0.01" placeholder="Ej. 100" title="Cuántos hijos salen de 1 padre" />
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>Ej: si 1 Padre = 100 Libras, pon 100</span>
                  </div>
                </>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Stock Inicial Físico</label>
                  <input required name="stock" value={formData.stock} onChange={handleInputChange} type="number" step="0.01" min="0" placeholder="Ej. 10" />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Alerta Min. Kardex</label>
                <input required name="min_stock_alert" value={formData.min_stock_alert} onChange={handleInputChange} type="number" step="0.01" min="0" placeholder="Ej. 2" />
              </div>

              <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                <button disabled={formLoading} type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem' }}>
                  {formLoading ? <Loader2 className="animate-spin" /> : 'Guardar Producto en Base de Datos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Fraccionamiento (Kardex) */}
      {showFractionModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} className="anim-fade-in">
          <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setShowFractionModal(false)} className="btn" style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', padding: '0.5rem' }}>
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1.5rem', color: 'hsl(var(--secondary))' }}><Beaker style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}/> Fraccionar Inventario</h2>
            <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              Esta acción descontará stock automáticamente del Quintal/Padre según el Factor de Conversión para generar la nueva cantidad.
            </p>

            {fractionError && (
               <div style={{ background: 'hsl(var(--danger) / 0.1)', color: 'hsl(var(--danger))', padding: '1rem', marginBottom: '1rem', borderRadius: 'var(--border-radius-sm)', fontSize: '0.875rem' }}>
                 {fractionError}
               </div>
            )}
            
            {fractionSuccess && (
               <div style={{ background: 'hsl(var(--success) / 0.1)', color: 'hsl(var(--success))', padding: '1rem', marginBottom: '1rem', borderRadius: 'var(--border-radius-sm)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <CheckCircle size={18} /> {fractionSuccess}
               </div>
            )}

            {!fractionSuccess && (
              <form onSubmit={handleFractionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Producto a Generar (Hijo)</label>
                  <select 
                    required 
                    value={fractionData.product_id} 
                    onChange={e => setFractionData({...fractionData, product_id: e.target.value})} 
                    style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-color)', border: '1px solid var(--glass-border)' }}
                  >
                    <option value="">Selecciona qué producto fraccionado deseas obtener...</option>
                    {childProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - (Factor: {p.conversion_factor})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Cantidad que deseas generar</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    min="0.01" 
                    placeholder="Ej. 10 (Se descontarán matemáticamente del padre)"
                    value={fractionData.quantity} 
                    onChange={e => setFractionData({...fractionData, quantity: e.target.value})} 
                  />
                </div>

                <button disabled={fractionLoading} type="submit" className="btn hover-lift" style={{ width: '100%', padding: '1rem', background: 'hsl(var(--secondary))', color: 'white', marginTop: '0.5rem' }}>
                  {fractionLoading ? <Loader2 className="animate-spin" /> : 'Ejecutar Fraccionamiento'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Ingreso de Stock (Entradas) */}
      {showEntryModal && selectedProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} className="anim-fade-in">
          <div className="glass" style={{ width: '100%', maxWidth: '450px', padding: '2rem', position: 'relative' }}>
            <button onClick={() => setShowEntryModal(false)} className="btn" style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', padding: '0.5rem' }}>
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1rem', color: 'hsl(var(--success))' }}><Plus style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}/> Ingreso de Stock</h2>
            <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              Registra una entrada de mercancía para: <b>{selectedProduct.name}</b>
            </p>

            {entryError && (
               <div style={{ background: 'hsl(var(--danger) / 0.1)', color: 'hsl(var(--danger))', padding: '1rem', marginBottom: '1rem', borderRadius: 'var(--border-radius-sm)', fontSize: '0.875rem' }}>
                 {entryError}
               </div>
            )}
            
            {entrySuccess && (
               <div style={{ background: 'hsl(var(--success) / 0.1)', color: 'hsl(var(--success))', padding: '1rem', marginBottom: '1rem', borderRadius: 'var(--border-radius-sm)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <CheckCircle size={18} /> {entrySuccess}
               </div>
            )}

            {!entrySuccess && (
              <form onSubmit={handleEntrySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Cantidad a Ingresar ({selectedProduct.unit_of_measure})</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    min="0.01" 
                    placeholder="0.00"
                    autoFocus
                    value={entryData.quantity} 
                    onChange={e => setEntryData({...entryData, quantity: e.target.value})} 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Nota / Motivo (Ej. Compra Fact#123)</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="Justifica esta entrada..."
                    value={entryData.notes} 
                    onChange={e => setEntryData({...entryData, notes: e.target.value})} 
                  />
                </div>

                <button disabled={entryLoading} type="submit" className="btn hover-lift" style={{ width: '100%', padding: '1rem', background: 'hsl(var(--success))', color: 'white', marginTop: '0.5rem' }}>
                  {entryLoading ? <Loader2 className="animate-spin" /> : 'Confirmar Ingreso'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Generador de Etiqueta (Printable) */}
      {showLabelModal && selectedProduct && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
        >
          <div className="glass no-print-modal" style={{ width: '100%', maxWidth: '450px', padding: '2rem', position: 'relative', textAlign: 'center' }}>
            <button onClick={() => setShowLabelModal(false)} className="btn no-print" style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', padding: '0.5rem' }}>
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1rem' }}>Vista Previa Etiqueta</h2>
            
            {labelLoading ? (
              <div style={{ padding: '2rem' }}><Loader2 className="animate-spin" color="hsl(var(--primary))" /></div>
            ) : (
              <div style={{ marginBottom: '2rem' }}>
                <div id="print-area" style={{ 
                  background: 'white', 
                  color: 'black', 
                  padding: '1rem', 
                  borderRadius: '4px', 
                  margin: '0 auto',
                  width: '300px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  border: '1px solid #ccc'
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '0.5rem', textAlign: 'center' }}>{selectedProduct.name}</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1rem' }}>${selectedProduct.sale_price.toFixed(2)}</div>
                  {selectedProduct.barcode && (
                    <Barcode 
                      value={selectedProduct.barcode} 
                      width={1.5} 
                      height={60} 
                      fontSize={14}
                      background="#ffffff"
                    />
                  )}
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: '#666' }}>KARDEXIS INVENTARIOS</div>
                </div>
              </div>
            )}

            <button onClick={handlePrint} className="btn btn-primary no-print" style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <Printer size={20} /> Imprimir Etiqueta Térmica
            </button>
            <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }} className="no-print">
              Tip: Se abrirá el diálogo de impresión con un formato optimizado.
            </p>
          </div>
        </div>
      )}

      {/* Print Style Specific Block (Injected at runtime style) */}
      <style>{`
        @media print {
          .app-container, header, main, .no-print, .btn, h2, p {
            display: none !important;
          }

          body, html {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          div[style*="fixed"] {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            background: transparent !important;
            backdrop-filter: none !important;
            width: 100% !important;
          }

          .glass.no-print-modal {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }

          #print-area {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 20px auto !important;
            padding: 20px !important;
            border: 1px solid #000 !important;
            width: 300px !important;
            visibility: visible !important;
          }

          #print-area * {
            visibility: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
