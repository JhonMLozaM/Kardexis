import os
import xml.etree.ElementTree as ET
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.graphics.barcode import code128
import barcode
from barcode.writer import ImageWriter

class SRIInvoiceHelper:
    def __init__(self):
        # Datos del Emisor (Configurables)
        self.ruc_emisor = "1790085854001"
        self.razon_social = "KARDEXIS S.A."
        self.nombre_comercial = "KARDEXIS"
        self.dir_matriz = "Av. Amazonas y Naciones Unidas, Quito"
        self.obligado_contabilidad = "NO"
        self.ambiente = "1" # 1: Pruebas, 2: Producción
        self.tipo_emision = "1" # 1: Normal
        self.establecimiento = "001"
        self.punto_emision = "001"
        self.secuencial = "000000001" # Esto debería ser dinámico de la DB
        self.codigo_numerico = "12345678" # 8 dígitos aleatorios o fijos

    def generar_digito_verificador(self, clave_48):
        # Algoritmo Módulo 11 para SRI
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

    def generar_clave_acceso(self, fecha_emision, secuencial):
        # Fecha en formato ddmmyyyy (8)
        fecha_str = fecha_emision.strftime("%d%m%Y")
        tipo_comprobante = "01" # 01: Factura
        ruc = self.ruc_emisor
        ambiente = self.ambiente
        serie = self.establecimiento + self.punto_emision
        # secuencial debe tener 9 dígitos
        secuencial_str = str(secuencial).zfill(9)
        codigo_num = self.codigo_numerico
        emision = self.tipo_emision
        
        clave_48 = fecha_str + tipo_comprobante + ruc + ambiente + serie + secuencial_str + codigo_num + emision
        dv = self.generar_digito_verificador(clave_48)
        return clave_48 + str(dv)

    def generar_xml(self, invoice_data, clave_acceso, business_data):
        # Estructura básica según Ficha Técnica SRI Factura v1.1.0
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
        ET.SubElement(info_trib, "estab").text = str(business_data.get("establishment", "001")).zfill(3)
        ET.SubElement(info_trib, "ptoEmi").text = str(business_data.get("emission_point", "001")).zfill(3)
        ET.SubElement(info_trib, "secuencial").text = clave_acceso[30:39]
        ET.SubElement(info_trib, "dirMatriz").text = business_data.get("address", self.dir_matriz)

        # Info Factura
        info_fact = ET.SubElement(root, "infoFactura")
        ET.SubElement(info_fact, "fechaEmision").text = datetime.now().strftime("%d/%m/%Y")
        ET.SubElement(info_fact, "dirEstablecimiento").text = business_data.get("address", self.dir_matriz)
        ET.SubElement(info_fact, "obligadoContabilidad").text = "SI" if business_data.get("is_required_to_keep_accounting") else "NO"
        ET.SubElement(info_fact, "tipoIdentificacionComprador").text = invoice_data["client_id_type"] # 05: Cedula, 04: RUC
        ET.SubElement(info_fact, "razonSocialComprador").text = invoice_data["client_name"]
        ET.SubElement(info_fact, "identificacionComprador").text = invoice_data["client_id"]
        ET.SubElement(info_fact, "totalSinImpuestos").text = f"{invoice_data['subtotal']:.2f}"
        ET.SubElement(info_fact, "totalDescuento").text = "0.00"

        # Totales Impuestos
        tot_imp = ET.SubElement(info_fact, "totalConImpuestos")
        total_impuesto = ET.SubElement(tot_imp, "totalImpuesto")
        ET.SubElement(total_impuesto, "codigo").text = "2" # IVA
        ET.SubElement(total_impuesto, "codigoPorcentaje").text = "0" # 0% IVA
        ET.SubElement(total_impuesto, "baseImponible").text = f"{invoice_data['subtotal']:.2f}"
        ET.SubElement(total_impuesto, "valor").text = "0.00"

        ET.SubElement(info_fact, "propina").text = "0.00"
        ET.SubElement(info_fact, "importeTotal").text = f"{invoice_data['total']:.2f}"
        ET.SubElement(info_fact, "moneda").text = "DOLAR"

        # Detalles (Productos)
        detalles = ET.SubElement(root, "detalles")
        for item in invoice_data["items"]:
            det = ET.SubElement(detalles, "detalle")
            ET.SubElement(det, "codigoPrincipal").text = item["barcode"][:25] if item["barcode"] else "001"
            ET.SubElement(det, "descripcion").text = item["name"]
            ET.SubElement(det, "cantidad").text = f"{item['quantity']:.2f}"
            ET.SubElement(det, "precioUnitario").text = f"{item['unit_price']:.2f}"
            ET.SubElement(det, "descuento").text = "0.00"
            ET.SubElement(det, "precioTotalSinImpuesto").text = f"{(item['quantity'] * item['unit_price']):.2f}"
            
            imps = ET.SubElement(det, "impuestos")
            imp = ET.SubElement(imps, "impuesto")
            ET.SubElement(imp, "codigo").text = "2"
            ET.SubElement(imp, "codigoPorcentaje").text = "0"
            ET.SubElement(imp, "tarifa").text = "0.00"
            ET.SubElement(imp, "baseImponible").text = f"{(item['quantity'] * item['unit_price']):.2f}"
            ET.SubElement(imp, "valor").text = "0.00"

        return ET.tostring(root, encoding="unicode")

    def generar_pdf(self, invoice_data, clave_acceso, output_path, business_data):
        doc = SimpleDocTemplate(output_path, pagesize=A4, rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
        elements = []
        styles = getSampleStyleSheet()
        
        # Estilos Personalizados
        style_title = ParagraphStyle('Title', parent=styles['Normal'], fontSize=10, leading=12, fontName='Helvetica-Bold')
        style_norm = ParagraphStyle('Norm', parent=styles['Normal'], fontSize=8, leading=10)
        style_small = ParagraphStyle('Small', parent=styles['Normal'], fontSize=7, leading=9)
        style_bold = ParagraphStyle('Bold', parent=styles['Normal'], fontSize=8, leading=10, fontName='Helvetica-Bold')
        style_table_header = ParagraphStyle('THead', parent=styles['Normal'], fontSize=8, leading=10, fontName='Helvetica-Bold', alignment=1)

        # ---------------------------------------------------------
        # CABECERA: Lado Izquierdo (Emisor/Logo) | Lado Derecho (RUC/Autorización)
        # ---------------------------------------------------------
        
        # Lado Izquierdo: Datos Emisor
        logo_path = None
        if business_data.get("logo_url"):
            # Mapear URL estática a ruta física: /static/logos/logo.png -> static/logos/logo.png
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
            [Paragraph(f"<b>Dirección Matriz:</b> {business_data.get('address', 'Quito')}", style_small)],
            [Paragraph(f"<b>Dirección Sucursal:</b> {business_data.get('address', 'Quito')}", style_small)],
            [Paragraph(f"<b>Contribuyente Especial:</b> {business_data.get('special_taxpayer_code', 'NO')}", style_small)],
            [Paragraph(f"<b>OBLIGADO A LLEVAR CONTABILIDAD:</b> {'SI' if business_data.get('is_required_to_keep_accounting') else 'NO'}", style_small)]
        ]
        emisor_table = Table(emisor_info, colWidths=[240])
        emisor_table.setStyle(TableStyle([('BOTTOMPADDING', (0,0), (-1,-1), 0)]))

        # Lado Derecho: RUC y Clave de Acceso
        ruc_info = [
            [Paragraph(f"<b>R.U.C.: {business_data.get('ruc', self.ruc_emisor)}</b>", style_title)],
            [Paragraph("<b>FACTURA</b>", style_title)],
            [Paragraph(f"No. {str(business_data.get('establishment', '001')).zfill(3)}-{str(business_data.get('emission_point', '001')).zfill(3)}-{clave_acceso[30:39]}", style_norm)],
            [Paragraph(f"<b>NÚMERO DE AUTORIZACIÓN:</b><br/>{clave_acceso}", style_small)],
            [Paragraph(f"<b>FECHA Y HORA DE AUTORIZACIÓN:</b><br/>{datetime.now().strftime('%d/%m/%Y %H:%M:%S')}", style_small)],
            [Paragraph(f"<b>AMBIENTE:</b> {'PRUEBAS' if self.ambiente == '1' else 'PRODUCCIÓN'}", style_small)],
            [Paragraph(f"<b>EMISIÓN:</b> NORMAL", style_small)],
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

        # ---------------------------------------------------------
        # BLOQUE CLIENTE
        # ---------------------------------------------------------
        client_info = [
            [Paragraph(f"<b>Razón Social / Nombres y Apellidos:</b> {invoice_data['client_name'].upper()}", style_norm), 
             Paragraph(f"<b>Identificación:</b> {invoice_data['client_id']}", style_norm)],
            [Paragraph(f"<b>Fecha Emisión:</b> {datetime.now().strftime('%d/%m/%Y')}", style_norm), 
             Paragraph("<b>Guía Remisión:</b> ", style_norm)]
        ]
        client_table = Table(client_info, colWidths=[370, 150])
        client_table.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ]))
        elements.append(client_table)
        elements.append(Spacer(1, 10))

        # ---------------------------------------------------------
        # TABLA DE DETALLES
        # ---------------------------------------------------------
        data = [[
            Paragraph("Cod. Principal", style_table_header),
            Paragraph("Cant", style_table_header),
            Paragraph("Descripción", style_table_header),
            Paragraph("P. Unitario", style_table_header),
            Paragraph("Descuento", style_table_header),
            Paragraph("Precio Total", style_table_header)
        ]]
        
        for item in invoice_data["items"]:
            data.append([
                Paragraph(item["barcode"][:15] if item["barcode"] else "--", style_norm),
                Paragraph(f"{item['quantity']:.2f}", style_norm),
                Paragraph(item["name"], style_norm),
                Paragraph(f"{item['unit_price']:.2f}", style_norm),
                Paragraph("0.00", style_norm),
                Paragraph(f"{(item['quantity'] * item['unit_price']):.2f}", style_norm)
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

        # ---------------------------------------------------------
        # BLOQUE FINAL: Info Adicional | Totales
        # ---------------------------------------------------------
        
        # Info Adicional
        info_adic_data = [
            [Paragraph("<b>Información Adicional</b>", style_bold)],
            [Paragraph(f"<b>Dirección:</b> {business_data.get('address', 'Ecuador')}", style_small)],
            [Paragraph(f"<b>Email:</b> {business_data.get('email', 'contacto@kardexis.com')}", style_small)],
            [Paragraph(f"<b>Teléfono:</b> {business_data.get('phone', '--')}", style_small)],
            [Paragraph("<b>Forma de Pago:</b> SIN UTILIZACIÓN DEL SISTEMA FINANCIERO", style_small)]
        ]
        info_adic_table = Table(info_adic_data, colWidths=[280])
        info_adic_table.setStyle(TableStyle([
            ('GRID', (0,0), (0,0), 0.5, colors.grey),
            ('BOX', (0,0), (-1,-1), 0.5, colors.grey),
        ]))

        # Totales
        totales_data = [
            [Paragraph("SUBTOTAL 15%", style_norm), Paragraph(f"{0.00:.2f}", style_norm)],
            [Paragraph("SUBTOTAL 0%", style_norm), Paragraph(f"{invoice_data['subtotal']:.2f}", style_norm)],
            [Paragraph("SUBTOTAL NO OBJETO IVA", style_norm), Paragraph("0.00", style_norm)],
            [Paragraph("SUBTOTAL SIN IMPUESTOS", style_norm), Paragraph(f"{invoice_data['subtotal']:.2f}", style_norm)],
            [Paragraph("DESCUENTO", style_norm), Paragraph("0.00", style_norm)],
            [Paragraph("ICE", style_norm), Paragraph("0.00", style_norm)],
            [Paragraph("IVA 15%", style_norm), Paragraph("0.00", style_norm)],
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

    def guardar_factura(self, invoice_data, business_data):
        # Crear la carpeta si no existe
        if not os.path.exists("facturas_ventas"):
            os.makedirs("facturas_ventas")
            
        # Generar Secuencial (En producción vendría de la DB)
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
