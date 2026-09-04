import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from database_pg import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)  # ADMIN, EMPLOYEE, MANAGER
    full_name = Column(String(100), nullable=False)
    active = Column(Boolean, default=True)
    dni = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    gender = Column(String(10), nullable=True)
    date_of_birth = Column(String(10), nullable=True)  # YYYY-MM-DD
    profile_picture_url = Column(Text, nullable=True)
    theme_color = Column(String(20), nullable=True)
    permissions = Column(Text, nullable=True)  # comma-separated: sales,products,customers,reports,attendance,business,staff
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    sales = relationship("Sale", back_populates="user")
    attendance_records = relationship("Attendance", back_populates="user")
    kardex_transactions = relationship("KardexTransaction", back_populates="user")


class UserSchedule(Base):
    __tablename__ = "user_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Domingo, 6=Sabado
    enabled = Column(Boolean, default=False)
    start_time = Column(String(5), nullable=True)  # HH:MM
    end_time = Column(String(5), nullable=True)  # HH:MM

    user = relationship("User", backref="schedules")


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    barcode = Column(String(50), unique=True, nullable=True, index=True)
    unit_of_measure = Column(String(20), nullable=False)
    cost_price = Column(Float, nullable=False)
    sale_price = Column(Float, nullable=False)
    stock = Column(Float, default=0)
    min_stock_alert = Column(Float, default=5)
    parent_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    conversion_factor = Column(Float, nullable=True)
    iva_rate = Column(Float, default=15)  # 0, 5, 12, 15 por ciento
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    parent_product = relationship("Product", remote_side=[id], backref="children")
    kardex_transactions = relationship("KardexTransaction", back_populates="product")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dni_ruc = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    id_type = Column(String(5), nullable=True)  # 04=RUC, 05=Cedula, 06=Pasaporte
    email = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relaciones
    sales = relationship("Sale", back_populates="customer")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id = Column(String(100), unique=True, nullable=True, index=True)
    client_id = Column(String(20), ForeignKey("customers.dni_ruc"), nullable=True)
    client_name = Column(String(200), nullable=False)
    client_id_type = Column(String(5), nullable=True)
    subtotal_15 = Column(Float, default=0)  # Subtotal IVA 15%
    subtotal_12 = Column(Float, default=0)  # Subtotal IVA 12%
    subtotal_5 = Column(Float, default=0)   # Subtotal IVA 5%
    subtotal_0 = Column(Float, default=0)   # Subtotal IVA 0%
    subtotal_no_objeto = Column(Float, default=0)  # No objeto de IVA
    subtotal_exento = Column(Float, default=0)     # Exento de IVA
    subtotal = Column(Float, nullable=False)
    iva_15 = Column(Float, default=0)
    iva_12 = Column(Float, default=0)
    iva_5 = Column(Float, default=0)
    tax = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    discount = Column(Float, default=0)
    payment_method = Column(String(20), default="cash")
    date = Column(DateTime, default=datetime.utcnow)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    clave_acceso = Column(String(50), nullable=True)
    pdf_path = Column(Text, nullable=True)
    xml_path = Column(Text, nullable=True)
    sri_status = Column(String(20), default="local")  # local, pending, authorized, rejected
    sri_error = Column(Text, nullable=True)

    # Relaciones
    user = relationship("User", back_populates="sales")
    customer = relationship("Customer", back_populates="sales")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    name = Column(String(200), nullable=False)
    barcode = Column(String(50), nullable=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    iva_rate = Column(Float, default=15)  # 0, 5, 12, 15
    discount = Column(Float, default=0)

    # Relaciones
    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")


class KardexTransaction(Base):
    __tablename__ = "kardex_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    transaction_type = Column(String(20), nullable=False)  # IN, OUT, ADJUSTMENT, TRANSFORMATION
    quantity = Column(Integer, nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)

    # Relaciones
    product = relationship("Product", back_populates="kardex_transactions")
    user = relationship("User", back_populates="kardex_transactions")


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    check_in = Column(String(8), nullable=True)  # HH:MM:SS
    check_out = Column(String(8), nullable=True)  # HH:MM:SS
    status = Column(String(20), default="active")  # active, completed, late
    notes = Column(Text, nullable=True)
    check_in_lat = Column(Float, nullable=True)
    check_in_lng = Column(Float, nullable=True)
    check_out_lat = Column(Float, nullable=True)
    check_out_lng = Column(Float, nullable=True)
    photo_url = Column(Text, nullable=True)

    # Relaciones
    user = relationship("User", back_populates="attendance_records")


class Business(Base):
    __tablename__ = "business"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    legal_name = Column(String(200), nullable=True)
    ruc = Column(String(20), nullable=False)
    address = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    establishment = Column(String(10), default="001")
    emission_point = Column(String(10), default="001")
    is_required_to_keep_accounting = Column(Boolean, default=False)
    special_taxpayer_code = Column(String(20), nullable=True)
    logo_url = Column(Text, nullable=True)
    # Configuracion SRI
    sri_enabled = Column(Boolean, default=False)  # SRI opcional
    sri_ambiente = Column(String(1), default="1")  # 1: Pruebas, 2: Produccion
    sri_tipo_emision = Column(String(1), default="1")  # 1: Normal, 2: Contingencia
    sri_contribuyente_especial = Column(String(20), nullable=True)
    sri_agente_retencion = Column(String(20), nullable=True)
    sri_regimen = Column(String(20), default="GENERAL")  # GENERAL, RIMPE, ESPECIAL
    email_template = Column(Text, nullable=True)  # Template de correo para facturas
    # Subscription fields
    subscription_plan_id = Column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=True)
    subscription_status = Column(String(20), default="trial")  # trial, active, past_due, canceled
    trial_ends_at = Column(DateTime, nullable=True)
    subscription_started_at = Column(DateTime, nullable=True)
    billing_email = Column(String(100), nullable=True)
    stripe_customer_id = Column(String(100), nullable=True)
    stripe_subscription_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User")
    subscription_plan = relationship("SubscriptionPlan")


class SRICatalog(Base):
    __tablename__ = "sri_catalog"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dni_ruc = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    city = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)


class InvoiceSequence(Base):
    __tablename__ = "invoice_sequences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("business.id"), nullable=False)
    doc_type = Column(String(5), nullable=False)  # 01: Factura, 04: Nota Credito, etc.
    establecimiento = Column(String(3), nullable=False)
    punto_emision = Column(String(3), nullable=False)
    current_sequence = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(500), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_revoked = Column(Boolean, default=False)

    user = relationship("User")


class CreditNote(Base):
    __tablename__ = "credit_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id = Column(String(100), unique=True, nullable=True, index=True)
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id"), nullable=False)
    client_id = Column(String(20), ForeignKey("customers.dni_ruc"), nullable=True)
    client_name = Column(String(200), nullable=False)
    client_id_type = Column(String(5), nullable=True)
    reason = Column(Text, nullable=False)
    subtotal_15 = Column(Float, default=0)
    subtotal_12 = Column(Float, default=0)
    subtotal_5 = Column(Float, default=0)
    subtotal_0 = Column(Float, default=0)
    subtotal = Column(Float, nullable=False)
    iva_15 = Column(Float, default=0)
    iva_12 = Column(Float, default=0)
    iva_5 = Column(Float, default=0)
    tax = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    clave_acceso = Column(String(50), nullable=True)
    pdf_path = Column(Text, nullable=True)
    xml_path = Column(Text, nullable=True)
    sri_status = Column(String(20), default="local")
    sri_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sale = relationship("Sale", backref="credit_notes")
    user = relationship("User")
    items = relationship("CreditNoteItem", back_populates="credit_note", cascade="all, delete-orphan")


class CreditNoteItem(Base):
    __tablename__ = "credit_note_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    credit_note_id = Column(UUID(as_uuid=True), ForeignKey("credit_notes.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    name = Column(String(200), nullable=False)
    barcode = Column(String(50), nullable=True)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    iva_rate = Column(Float, default=0)
    discount = Column(Float, default=0)

    credit_note = relationship("CreditNote", back_populates="items")


class CustomerNote(Base):
    __tablename__ = "customer_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(String(20), ForeignKey("customers.dni_ruc"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    note = Column(Text, nullable=False)
    note_type = Column(String(20), default="general")  # general, follow_up, sale, complaint
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class CashClose(Base):
    __tablename__ = "cash_closes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id = Column(String(100), unique=True, nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    user_name = Column(String(100), nullable=False)
    date = Column(Date, nullable=False)
    opening_amount = Column(Float, default=0)
    closing_amount = Column(Float, default=0)
    expected_amount = Column(Float, default=0)
    difference = Column(Float, default=0)
    sales_count = Column(Integer, default=0)
    sales_total = Column(Float, default=0)
    payment_breakdown = Column(Text, nullable=True)  # JSON string
    status = Column(String(20), default="open")  # open, closed
    created_at = Column(DateTime, default=datetime.utcnow)
    synced_at = Column(DateTime, nullable=True)

    user = relationship("User")


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    price_monthly = Column(Float, default=0)
    price_yearly = Column(Float, default=0)
    max_users = Column(Integer, default=1)
    max_products = Column(Integer, default=100)
    max_invoices_monthly = Column(Integer, default=50)
    features = Column(JSONB, default=dict)  # feature flags
    created_at = Column(DateTime, default=datetime.utcnow)


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_id = Column(UUID(as_uuid=True), ForeignKey("business.id"), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="USD")
    payment_method = Column(String(30), nullable=True)  # stripe, kushki, bank_transfer
    stripe_payment_id = Column(String(100), nullable=True)
    stripe_session_id = Column(String(200), nullable=True)
    kushki_id = Column(String(100), nullable=True)
    status = Column(String(20), default="pending")  # pending, completed, failed, refunded
    plan_slug = Column(String(50), nullable=True)
    billing_period = Column(String(10), nullable=True)  # monthly, yearly
    receipt_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business = relationship("Business")
