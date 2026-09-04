import os
import random
import xml.etree.ElementTree as ET
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

# Codigos de IVA SRI 2026
IVA_CODES = {
    0: {"code": "0", "percent": "0", "label": "0%"},
    5: {"code": "5", "percent": "5", "label": "5%"},
    12: {"code": "2", "percent": "12", "label": "12%"},
    15: {"code": "3", "percent": "15", "label": "15%"},
}

# Codigos de forma de pago SRI
PAYMENT_CODES = {
    "cash": {"code": "01", "label": "SIN UTILIZACION DEL SISTEMA FINANCIERO"},
    "card": {"code": "19", "label": "TARJETA DE CREDITO"},
    "transfer": {"code": "20", "label": "TRANSFERENCIA BANCARIA"},
    "qr": {"code": "17", "label": "DINERO ELECTRONICO"},
    "mixed": {"code": "01", "label": "OTROS"},
}


class SRIInvoiceHelper:
    def __init__(self, business_data=None):
        self.business_data = business_data or {}
        # Datos por defecto si no hay business
        self.ruc_emisor = self.business_data.get("ruc", "1790085854001")
        self.razon_social = self.business_data.get("legal_name", "KARDEXIS S.A.")
        self.nombre_comercial = self.business_data.get("name", "KARDEXIS")
        self.dir_matriz = self.business_data.get("address", "Av. Amazonas y Naciones Unidas, Quito")
        self.obligado_contabilidad = "SI" if self.business_data.get("is_required_to_keep_accounting") else "NO"
        self.ambiente = self.business_data.get("sri_ambiente", "1")
        self.tipo_emision = self.business_data.get("sri_tipo_emision", "1")
        self.establecimiento = str(self.business_data.get("establishment", "001")).zfill(3)
        self.punto_emision = str(self.business_data.get("emission_point", "001")).zfill(3)

    def generar_digito_verificador(self, clave_48):
        suma = 0
        factor = 2
        for i in range(len(clave_48) - 1, -1, -1):
            suma += int(clave_48[i]) * factor
            factor += 1
            if factor > 7:
                factor = 2
        residuo = suma % 11
        digito = 11 - residuo
        if digito == 11:
            return 0
        elif digito == 10:
            return 1
        return digito

    def generar_clave_acceso(self, fecha_emision, secuencial, tipo_comprobante="01"):
        fecha_str = fecha_emision.strftime("%d%m%Y")
        ruc = self.ruc_emisor
        ambiente = self.ambiente
        serie = self.establecimiento + self.punto_emision
        secuencial_str = str(secuencial).zfill(9)
        codigo_num = str(random.randint(10000000, 99999999))
        emision = self.tipo_emision

        clave_48 = fecha_str + tipo_comprobante + ruc + ambiente + serie + secuencial_str + codigo_num + emision
        dv = self.generar_digito_verificador(clave_48)
        return clave_48 + str(dv)

    def calcular_iva_por_items(self, items):
        """Calcula subtotales por tarifa de IVA"""
        subtotales = {0: 0, 5: 0, 12: 0, 15: 0}
        for item in items:
            rate = item.get("iva_rate", 15)
            base = item["quantity"] * item["unit_price"] - item.get("discount", 0)
            if rate in subtotales:
                subtotales[rate] += base
            else:
                subtotales[15] += base  # Default 15%
        return subtotales

    def calcular_iva_total(self, subtotales):
        """Calcula el IVA total por tarifa"""
        ivas = {}
        for rate, subtotal in subtotales.items():
            if rate > 0 and subtotal > 0:
                ivas[rate] = round(subtotal * rate / 100, 2)
        return ivas

    def generar_xml(self, invoice_data, clave_acceso, business_data):
        root = ET.Element("factura", id="comprobante", version="1.1.0")

        # Info Tributaria
        info_trib = ET.SubElement(root, "infoTributaria")
        ET.SubElement(info_trib, "ambiente").text = self.ambiente
        ET.SubElement(info_trib, "tipoEmision").text = self.tipo_emision
        ET.SubElement(info_trib, "razonSocial").text = business_data.get("legal_name", self.razon_social)
        ET.SubElement(info_trib, "nombreComercial").text = business_data.get("name", self.nombre_comercial)
        ET.SubElement(info_trib, "ruc").text = business_data.get("ruc", self.ruc_emisor)
        ET.SubElement(info_trib, "claveAcceso").text = clave_acceso
        ET.SubElement(info_trib, "codDoc").text = "01"
        ET.SubElement(info_trib, "estab").text = self.establecimiento
        ET.SubElement(info_trib, "ptoEmi").text = self.punto_emision
        ET.SubElement(info_trib, "secuencial").text = clave_acceso[30:39]
        ET.SubElement(info_trib, "dirMatriz").text = business_data.get("address", self.dir_matriz)

        # Info Factura
        info_fact = ET.SubElement(root, "infoFactura")
        ET.SubElement(info_fact, "fechaEmision").text = datetime.now().strftime("%d/%m/%Y")
        ET.SubElement(info_fact, "dirEstablecimiento").text = business_data.get("address", self.dir_matriz)
        ET.SubElement(info_fact, "obligadoContabilidad").text = "SI" if business_data.get("is_required_to_keep_accounting") else "NO"

        # Identificacion del comprador
        client_id_type = invoice_data.get("client_id_type", "05")
        ET.SubElement(info_fact, "tipoIdentificacionComprador").text = client_id_type
        ET.SubElement(info_fact, "razonSocialComprador").text = invoice_data["client_name"]
        ET.SubElement(info_fact, "identificacionComprador").text = invoice_data["client_id"]

        # Subtotales por tarifa de IVA
        items_with_rate = []
        for item in invoice_data["items"]:
            items_with_rate.append({
                **item,
                "iva_rate": item.get("iva_rate", 15),
                "discount": item.get("discount", 0),
            })

        subtotales = self.calcular_iva_por_items(items_with_rate)
        total_sin_impuestos = sum(subtotales.values())

        ET.SubElement(info_fact, "totalSinImpuestos").text = f"{total_sin_impuestos:.2f}"

        # Descuento total
        total_descuento = sum(item.get("discount", 0) for item in items_with_rate)
        ET.SubElement(info_fact, "totalDescuento").text = f"{total_descuento:.2f}"

        # Totales Impuestos (solo tarifas con valor > 0)
        tot_imp = ET.SubElement(info_fact, "totalConImpuestos")
        for rate in [0, 5, 12, 15]:
            if subtotales.get(rate, 0) > 0:
                total_impuesto = ET.SubElement(tot_imp, "totalImpuesto")
                ET.SubElement(total_impuesto, "codigo").text = "2"  # IVA
                ET.SubElement(total_impuesto, "codigoPorcentaje").text = IVA_CODES[rate]["code"]
                ET.SubElement(total_impuesto, "baseImponible").text = f"{subtotales[rate]:.2f}"
                if rate > 0:
                    iva_valor = round(subtotales[rate] * rate / 100, 2)
                    ET.SubElement(total_impuesto, "valor").text = f"{iva_valor:.2f}"
                else:
                    ET.SubElement(total_impuesto, "valor").text = "0.00"

        ET.SubElement(info_fact, "propina").text = "0.00"
        ET.SubElement(info_fact, "importeTotal").text = f"{invoice_data['total']:.2f}"
        ET.SubElement(info_fact, "moneda").text = "DOLAR"

        # Forma de pago
        pagos = ET.SubElement(info_fact, "pagos")
        pago = ET.SubElement(pagos, "pago")
        payment_method = invoice_data.get("payment_method", "cash")
        payment_info = PAYMENT_CODES.get(payment_method, PAYMENT_CODES["cash"])
        ET.SubElement(pago, "formaPago").text = payment_info["code"]
        ET.SubElement(pago, "total").text = f"{invoice_data['total']:.2f}"
        ET.SubElement(pago, "plazo").text = "0"
        ET.SubElement(pago, "unidadTiempo").text = "dias"

        # Detalles (Productos)
        detalles = ET.SubElement(root, "detalles")
        for item in items_with_rate:
            det = ET.SubElement(detalles, "detalle")
            ET.SubElement(det, "codigoPrincipal").text = item["barcode"][:25] if item.get("barcode") else "001"
            ET.SubElement(det, "descripcion").text = item["name"]
            ET.SubElement(det, "cantidad").text = f"{item['quantity']:.2f}"
            ET.SubElement(det, "precioUnitario").text = f"{item['unit_price']:.2f}"
            ET.SubElement(det, "descuento").text = f"{item.get('discount', 0):.2f}"

            base_imponible = item["quantity"] * item["unit_price"] - item.get("discount", 0)
            ET.SubElement(det, "precioTotalSinImpuesto").text = f"{base_imponible:.2f}"

            rate = item.get("iva_rate", 15)
            iva_valor = round(base_imponible * rate / 100, 2) if rate > 0 else 0

            imps = ET.SubElement(det, "impuestos")
            imp = ET.SubElement(imps, "impuesto")
            ET.SubElement(imp, "codigo").text = "2"
            ET.SubElement(imp, "codigoPorcentaje").text = IVA_CODES[rate]["code"]
            ET.SubElement(imp, "tarifa").text = str(rate)
            ET.SubElement(imp, "baseImponible").text = f"{base_imponible:.2f}"
            ET.SubElement(imp, "valor").text = f"{iva_valor:.2f}"

        # Info Adicional
        info_adic = ET.SubElement(root, "infoAdicional")
        if business_data.get("address"):
            ET.SubElement(info_adic, "campoAdicional", nombre="Direccion").text = business_data["address"]
        if business_data.get("email"):
            ET.SubElement(info_adic, "campoAdicional", nombre="Email").text = business_data["email"]
        if business_data.get("phone"):
            ET.SubElement(info_adic, "campoAdicional", nombre="Telefono").text = business_data["phone"]

        return ET.tostring(root, encoding="unicode")

    def generar_pdf(self, invoice_data, clave_acceso, output_path, business_data):
        doc = SimpleDocTemplate(output_path, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
        elements = []
        styles = getSampleStyleSheet()

        style_title = ParagraphStyle('Title', parent=styles['Normal'], fontSize=10, leading=12, fontName='Helvetica-Bold')
        style_norm = ParagraphStyle('Norm', parent=styles['Normal'], fontSize=8, leading=10)
        style_small = ParagraphStyle('Small', parent=styles['Normal'], fontSize=7, leading=9)
        style_bold = ParagraphStyle('Bold', parent=styles['Normal'], fontSize=8, leading=10, fontName='Helvetica-Bold')
        style_table_header = ParagraphStyle('THead', parent=styles['Normal'], fontSize=8, leading=10, fontName='Helvetica-Bold', alignment=1)

        # Cabecera
        logo_path = None
        if business_data.get("logo_url"):
            relative_path = business_data["logo_url"].lstrip("/")
            if os.path.exists(relative_path):
                logo_path = relative_path

        logo_img = None
        if logo_path:
            logo_img = Image(logo_path, width=120, height=120, kind='proportional')
            logo_img.hAlign = 'LEFT'

        emisor_info = [
            [logo_img if logo_img else Paragraph(f"<font size=14 color='#E11D48'><b>{business_data.get('name', 'KARDEXIS')}</b></font>", style_norm)],
            [Paragraph(f"<b>{business_data.get('legal_name', 'KARDEXIS S.A.')}</b>", style_norm)],
            [Spacer(1, 4)],
            [Paragraph(f"<b>Direccion Matriz:</b> {business_data.get('address', 'Quito')}", style_small)],
            [Paragraph(f"<b>Direccion Sucursal:</b> {business_data.get('address', 'Quito')}", style_small)],
            [Paragraph(f"<b>Contribuyente Especial:</b> {business_data.get('special_taxpayer_code', 'NO')}", style_small)],
            [Paragraph(f"<b>OBLIGADO A LLEVAR CONTABILIDAD:</b> {'SI' if business_data.get('is_required_to_keep_accounting') else 'NO'}", style_small)]
        ]
        emisor_table = Table(emisor_info, colWidths=[240])
        emisor_table.setStyle(TableStyle([('BOTTOMPADDING', (0,0), (-1,-1), 0)]))

        ruc_info = [
            [Paragraph(f"<b>R.U.C.: {business_data.get('ruc', self.ruc_emisor)}</b>", style_title)],
            [Paragraph("<b>FACTURA</b>", style_title)],
            [Paragraph(f"No. {self.establecimiento}-{self.punto_emision}-{clave_acceso[30:39]}", style_norm)],
            [Paragraph(f"<b>NUMERO DE AUTORIZACION:</b><br/>{clave_acceso}", style_small)],
            [Paragraph(f"<b>FECHA Y HORA DE AUTORIZACION:</b><br/>{datetime.now().strftime('%d/%m/%Y %H:%M:%S')}", style_small)],
            [Paragraph(f"<b>AMBIENTE:</b> {'PRUEBAS' if self.ambiente == '1' else 'PRODUCCION'}", style_small)],
            [Paragraph("<b>EMISION:</b> NORMAL", style_small)],
            [Paragraph("<b>CLAVE DE ACCESO:</b>", style_small)],
            [Paragraph(clave_acceso, style_small)]
        ]
        ruc_table = Table(ruc_info, colWidths=[260])
        ruc_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
        ]))

        header_main = Table([[emisor_table, ruc_table]], colWidths=[260, 260])
        elements.append(header_main)
        elements.append(Spacer(1, 10))

        # Cliente
        client_info = [
            [Paragraph(f"<b>Razon Social / Nombres y Apellidos:</b> {invoice_data['client_name'].upper()}", style_norm),
             Paragraph(f"<b>Identificacion:</b> {invoice_data['client_id']}", style_norm)],
            [Paragraph(f"<b>Fecha Emision:</b> {datetime.now().strftime('%d/%m/%Y')}", style_norm),
             Paragraph("<b>Guia Remision:</b> ", style_norm)]
        ]
        client_table = Table(client_info, colWidths=[370, 150])
        client_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ]))
        elements.append(client_table)
        elements.append(Spacer(1, 10))

        # Tabla de detalles
        data = [[
            Paragraph("Cod. Principal", style_table_header),
            Paragraph("Cant", style_table_header),
            Paragraph("Descripcion", style_table_header),
            Paragraph("P. Unitario", style_table_header),
            Paragraph("Descuento", style_table_header),
            Paragraph("Precio Total", style_table_header)
        ]]

        for item in invoice_data["items"]:
            data.append([
                Paragraph(item.get("barcode", "--")[:15] if item.get("barcode") else "--", style_norm),
                Paragraph(f"{item['quantity']:.2f}", style_norm),
                Paragraph(item["name"], style_norm),
                Paragraph(f"{item['unit_price']:.2f}", style_norm),
                Paragraph(f"{item.get('discount', 0):.2f}", style_norm),
                Paragraph(f"{(item['quantity'] * item['unit_price'] - item.get('discount', 0)):.2f}", style_norm)
            ])

        detail_table = Table(data, colWidths=[80, 40, 240, 60, 50, 50])
        detail_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.Color(0.9, 0.9, 0.9)),
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ALIGN', (1,1), (-1,-1), 'CENTER'),
        ]))
        elements.append(detail_table)
        elements.append(Spacer(1, 15))

        # Calcular subtotales por IVA
        items_with_rate = [{**item, "iva_rate": item.get("iva_rate", 15), "discount": item.get("discount", 0)} for item in invoice_data["items"]]
        subtotales = self.calcular_iva_por_items(items_with_rate)
        ivas = self.calcular_iva_total(subtotales)
        total_descuento = sum(item.get("discount", 0) for item in items_with_rate)

        # Info Adicional
        payment_method = invoice_data.get("payment_method", "cash")
        payment_info = PAYMENT_CODES.get(payment_method, PAYMENT_CODES["cash"])

        info_adic_data = [
            [Paragraph("<b>Informacion Adicional</b>", style_bold)],
            [Paragraph(f"<b>Direccion:</b> {business_data.get('address', 'Ecuador')}", style_small)],
            [Paragraph(f"<b>Email:</b> {business_data.get('email', 'contacto@kardexis.com')}", style_small)],
            [Paragraph(f"<b>Telefono:</b> {business_data.get('phone', '--')}", style_small)],
            [Paragraph(f"<b>Forma de Pago:</b> {payment_info['label']}", style_small)]
        ]
        info_adic_table = Table(info_adic_data, colWidths=[280])
        info_adic_table.setStyle(TableStyle([
            ('GRID', (0,0), (0,0), 0.5, colors.grey),
            ('BOX', (0,0), (-1,-1), 0.5, colors.grey),
        ]))

        # Totales
        total_sin_impuestos = sum(subtotales.values())
        total_iva = sum(ivas.values())
        iva_15 = ivas.get(15, 0)
        iva_12 = ivas.get(12, 0)
        iva_5 = ivas.get(5, 0)

        totales_data = [
            [Paragraph("SUBTOTAL 15%", style_norm), Paragraph(f"{subtotales.get(15, 0):.2f}", style_norm)],
            [Paragraph("SUBTOTAL 12%", style_norm), Paragraph(f"{subtotales.get(12, 0):.2f}", style_norm)],
            [Paragraph("SUBTOTAL 5%", style_norm), Paragraph(f"{subtotales.get(5, 0):.2f}", style_norm)],
            [Paragraph("SUBTOTAL 0%", style_norm), Paragraph(f"{subtotales.get(0, 0):.2f}", style_norm)],
            [Paragraph("SUBTOTAL NO OBJETO IVA", style_norm), Paragraph("0.00", style_norm)],
            [Paragraph("SUBTOTAL SIN IMPUESTOS", style_norm), Paragraph(f"{total_sin_impuestos:.2f}", style_norm)],
            [Paragraph("DESCUENTO", style_norm), Paragraph(f"{total_descuento:.2f}", style_norm)],
            [Paragraph("ICE", style_norm), Paragraph("0.00", style_norm)],
            [Paragraph("IVA 15%", style_norm), Paragraph(f"{iva_15:.2f}", style_norm)],
            [Paragraph("IVA 12%", style_norm), Paragraph(f"{iva_12:.2f}", style_norm)],
            [Paragraph("IVA 5%", style_norm), Paragraph(f"{iva_5:.2f}", style_norm)],
            [Paragraph("VALOR TOTAL", style_bold), Paragraph(f"<b>{invoice_data['total']:.2f}</b>", style_bold)]
        ]
        totales_table = Table(totales_data, colWidths=[150, 70])
        totales_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ]))

        footer_main = Table([[info_adic_table, totales_table]], colWidths=[300, 220])
        footer_main.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
        elements.append(footer_main)

        doc.build(elements)

    def guardar_factura(self, invoice_data, business_data, sequence=None):
        if not os.path.exists("facturas_ventas"):
            os.makedirs("facturas_ventas")

        # Usar secuencial de la DB si se proporciona, sino generar uno
        if sequence is not None:
            secuencial = sequence
        else:
            secuencial = int(datetime.timestamp(datetime.now())) % 100000000

        clave = self.generar_clave_acceso(datetime.now(), secuencial)

        xml_content = self.generar_xml(invoice_data, clave, business_data)
        pdf_name = f"facturas_ventas/factura_{clave}.pdf"
        xml_name = f"facturas_ventas/factura_{clave}.xml"

        with open(xml_name, "w", encoding="utf-8") as f:
            f.write(xml_content)

        self.generar_pdf(invoice_data, clave, pdf_name, business_data)

        return {
            "clave_acceso": clave,
            "pdf_path": pdf_name,
            "xml_path": xml_name
        }
