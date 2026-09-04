"""Servicio de envio de correos electronicos."""
import os
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from jinja2 import Template

from config import settings

# Template por defecto de factura
DEFAULT_INVOICE_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
        .header h1 { color: #e11d48; margin: 0; font-size: 24px; }
        .header p { color: #666; margin: 5px 0 0; }
        .header img { max-width: 150px; max-height: 80px; margin-bottom: 10px; border-radius: 4px; }
        .invoice-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .invoice-box h2 { color: #e11d48; margin-top: 0; font-size: 18px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #666; }
        .detail-value { font-weight: 600; }
        .total-box { background: #f0fdf4; padding: 15px; border-radius: 8px; text-align: right; margin-top: 15px; }
        .total-label { font-size: 14px; color: #666; }
        .total-value { font-size: 24px; font-weight: 800; color: #16a34a; }
        .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px; }
        .clave-acceso { background: #fef3c7; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 11px; word-break: break-all; margin-top: 15px; }
    </style>
</head>
<body>
    <div class="header">
        {% if business_logo %}
        <img src="{{ business_logo }}" alt="Logo {{ business_name }}">
        {% endif %}
        <h1>{{ business_name }}</h1>
        <p>{{ business_legal_name }}</p>
        <p>RUC: {{ business_ruc }}</p>
    </div>

    <div class="invoice-box">
        <h2>Factura Electronica</h2>
        <div class="detail-row">
            <span class="detail-label">Numero:</span>
            <span class="detail-value">{{ establishment }}-{{ emission_point }}-{{ sequential }}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Fecha:</span>
            <span class="detail-value">{{ sale_date }}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Cliente:</span>
            <span class="detail-value">{{ client_name }}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Identificacion:</span>
            <span class="detail-value">{{ client_id }}</span>
        </div>
    </div>

    <div class="invoice-box">
        <h2>Detalle de Productos</h2>
        {% for item in items %}
        <div class="detail-row">
            <span class="detail-label">{{ item.name }} x{{ item.quantity }}</span>
            <span class="detail-value">${{ "%.2f"|format(item.quantity * item.unit_price) }}</span>
        </div>
        {% endfor %}
    </div>

    <div class="total-box">
        <div class="total-label">Total a Pagar</div>
        <div class="total-value">${{ "%.2f"|format(total) }}</div>
    </div>

    {% if clave_acceso %}
    <div class="clave-acceso">
        <strong>Clave de Acceso SRI:</strong><br>
        {{ clave_acceso }}
    </div>
    {% endif %}

    <div class="footer">
        <p>Gracias por su compra!</p>
        <p>{{ business_address }}</p>
        <p>{{ business_phone }} | {{ business_email }}</p>
    </div>
</body>
</html>
"""

# Template de credito
DEFAULT_CREDIT_NOTE_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
        .header h1 { color: #d97706; margin: 0; font-size: 24px; }
        .content { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Nota de Credito</h1>
        <p>{{ business_name }} - RUC: {{ business_ruc }}</p>
    </div>
    <div class="content">
        <p><strong>Cliente:</strong> {{ client_name }}</p>
        <p><strong>Factura Referencia:</strong> {{ reference_invoice }}</p>
        <p><strong>Monto:</strong> ${{ "%.2f"|format(amount) }}</p>
        <p><strong>Motivo:</strong> {{ reason }}</p>
    </div>
</body>
</html>
"""


class EmailService:
    def __init__(self, business_data=None):
        self.business_data = business_data or {}
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.smtp_from = settings.SMTP_FROM or settings.SMTP_USER
        self.smtp_from_name = settings.SMTP_FROM_NAME
        self.enabled = settings.SMTP_ENABLED

    async def send_invoice_email(
        self,
        to_email: str,
        client_name: str,
        sale_data: dict,
        pdf_path: str = None,
        xml_path: str = None,
    ) -> bool:
        """Enviar factura por correo electronico"""
        if not self.enabled or not self.smtp_user:
            print(f"[EMAIL] Saltando envio - enabled={self.enabled}, user={self.smtp_user or '(vacio)'}")
            return False

        try:
            print(f"[EMAIL] Enviando factura a {to_email}...")
            # Renderizar template
            template = Template(self.business_data.get("email_template", DEFAULT_INVOICE_TEMPLATE))

            # Obtener secuencial del clave_acceso
            clave = sale_data.get("clave_acceso", "")
            sequential = clave[30:39] if len(clave) >= 39 else "000000001"

            # Construir URL completa del logo (desde frontend/public)
            logo_url = self.business_data.get("logo_url", "")
            if logo_url:
                # Si el logo esta en backend/static/logos, servirlo desde ahi
                if logo_url.startswith("/static/logos/"):
                    logo_url = f"{settings.BACKEND_URL}{logo_url}"
                elif not logo_url.startswith("http"):
                    logo_url = f"{settings.FRONTEND_URL}{logo_url}"

            html_content = template.render(
                business_name=self.business_data.get("name", "KARDEXIS"),
                business_legal_name=self.business_data.get("legal_name", ""),
                business_ruc=self.business_data.get("ruc", ""),
                business_address=self.business_data.get("address", ""),
                business_phone=self.business_data.get("phone", ""),
                business_email=self.business_data.get("email", ""),
                business_logo=logo_url,
                establishment=self.business_data.get("establishment", "001"),
                emission_point=self.business_data.get("emission_point", "001"),
                sequential=sequential,
                sale_date=sale_data.get("date", ""),
                client_name=client_name,
                client_id=sale_data.get("client_id", ""),
                items=sale_data.get("items", []),
                total=sale_data.get("total", 0),
                clave_acceso=clave,
            )

            # Crear mensaje
            msg = MIMEMultipart()
            msg["From"] = f"{self.smtp_from_name} <{self.smtp_from}>"
            msg["To"] = to_email
            msg["Subject"] = f"Factura {self.business_data.get('name', '')} - {sale_data.get('client_name', '')}"
            msg.attach(MIMEText(html_content, "html", "utf-8"))

            # Adjuntar PDF
            if pdf_path and os.path.exists(pdf_path):
                with open(pdf_path, "rb") as f:
                    pdf_attachment = MIMEApplication(f.read(), _subtype="pdf")
                    pdf_attachment.add_header(
                        "Content-Disposition",
                        "attachment",
                        filename=f"factura_{clave}.pdf"
                    )
                    msg.attach(pdf_attachment)

            # Adjuntar XML
            if xml_path and os.path.exists(xml_path):
                with open(xml_path, "rb") as f:
                    xml_attachment = MIMEApplication(f.read(), _subtype="xml")
                    xml_attachment.add_header(
                        "Content-Disposition",
                        "attachment",
                        filename=f"factura_{clave}.xml"
                    )
                    msg.attach(xml_attachment)

            # Enviar
            await aiosmtplib.send(
                msg,
                hostname=self.smtp_host,
                port=self.smtp_port,
                start_tls=True,
                username=self.smtp_user,
                password=self.smtp_password,
            )

            print(f"[EMAIL] Enviado exitosamente a {to_email}")
            return True

        except Exception as e:
            print(f"[EMAIL] Error: {str(e)}")
            return False

    def get_template(self) -> str:
        """Obtener template de correo"""
        return self.business_data.get("email_template", DEFAULT_INVOICE_TEMPLATE)

    def set_template(self, template: str):
        """Establecer template de correo"""
        self.business_data["email_template"] = template
