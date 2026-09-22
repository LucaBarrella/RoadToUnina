import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image

def create_delivery_pdf(output_path):
    # Setup document with exact 1-page margins (A4 is 595.27 x 841.89 pt)
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=32,
        rightMargin=32,
        topMargin=28,
        bottomMargin=28
    )

    styles = getSampleStyleSheet()
    
    # Custom Typography Styles
    uni_style = ParagraphStyle(
        'UniTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#0F172A'),
        alignment=0
    )
    
    course_style = ParagraphStyle(
        'CourseSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#475569'),
        alignment=0
    )
    
    doc_tag_style = ParagraphStyle(
        'DocTag',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#0284C7'),
        alignment=2
    )

    doc_tag_sub = ParagraphStyle(
        'DocTagSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#64748B'),
        alignment=2
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=3,
        spaceBefore=1
    )
    
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#334155')
    )

    cell_label = ParagraphStyle(
        'CellLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#0F172A')
    )

    cell_value = ParagraphStyle(
        'CellValue',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#334155')
    )

    story = []

    # 1. Header Section with Logo
    logo_path = os.path.join(os.path.dirname(__file__), 'frontend', 'src', 'assets', 'logo.png')
    logo_img = Image(logo_path, width=44, height=44) if os.path.exists(logo_path) else Paragraph("🎓", uni_style)

    header_table_data = [
        [
            logo_img,
            [
                Paragraph("UNIVERSITÀ DEGLI STUDI DI NAPOLI FEDERICO II", uni_style),
                Paragraph("Corso di Laurea in Informatica — Corso di Tecnologie Web (A.A. 2025/2026)", course_style),
                Paragraph("Docente: <b>Prof. Luigi Libero Lucio Starace, Ph.D.</b>", course_style),
            ],
            [
                Paragraph("SCHEDA PROGETTO", doc_tag_style),
                Paragraph("Consegna Ufficiale Sez. 5", doc_tag_sub),
                Paragraph("RoadToUnina (Speedrun)", doc_tag_sub),
            ]
        ]
    ]

    t_header = Table(header_table_data, colWidths=[50, 345, 136])
    t_header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284C7'), spaceBefore=2, spaceAfter=7))

    # 2. Student & Project Identification Grid
    data_info = [
        [
            Paragraph("Candidato:", cell_label), Paragraph("<b>Luca Barrella</b>", cell_value),
            Paragraph("Matricola:", cell_label), Paragraph("<b>N86004677</b>", cell_value)
        ],
        [
            Paragraph("Traccia Assegnata:", cell_label), Paragraph("<b>RoadToUnina</b> (Traccia Sez. 4)", cell_value),
            Paragraph("Data Elaborato:", cell_label), Paragraph("Settembre 2026", cell_value)
        ],
        [
            Paragraph("Demo Web Frontend:", cell_label), Paragraph('<font color="#0284C7"><u>https://road-to-unina.vercel.app</u></font>', cell_value),
            Paragraph("Backend REST API:", cell_label), Paragraph('<font color="#0284C7"><u>https://roadtounina-backend.onrender.com/api</u></font>', cell_value)
        ],
        [
            Paragraph("OpenAPI Docs & UI:", cell_label), Paragraph('<font color="#0284C7"><u>https://roadtounina-backend.onrender.com/api/docs</u></font>', cell_value),
            Paragraph("Automated Tests:", cell_label), Paragraph("<b>58 Vitest (100%) + 19 Playwright E2E</b>", cell_value)
        ]
    ]

    t_info = Table(data_info, colWidths=[105, 165, 95, 166])
    t_info.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
    ]))
    story.append(t_info)
    story.append(Spacer(1, 8))

    # 3. Project Overview & Rules
    story.append(Paragraph("1. Sintesi Architetturale & Regole della Sfida", section_heading))
    desc_text = (
        "<b>RoadToUnina</b> è un'applicazione web moderna full-stack concepita per speedrun enciclopedici su Wikipedia Italia. "
        "Gli utenti registrati avviano una sessione partendo da una voce casuale (estratta tramite <i>MediaWiki API</i>) "
        "con l'obiettivo di raggiungere la voce cardine <i>'Università degli Studi di Napoli Federico II'</i> navigando <b>esclusivamente "
        "attraverso i collegamenti ipertestuali interni validi</b> (Namespace 0). Lo stato della partita è persistito lato server su "
        "PostgreSQL per consentire il ripristino di sessione multi-dispositivo. Gli utenti non autenticati (ospiti) possono consultare liberamente "
        "la classifica globale e lo storico delle partite concluse con relativo percorso e statistiche."
    )
    story.append(Paragraph(desc_text, body_style))
    story.append(Spacer(1, 7))

    # 4. Technologies & Software Engineering Standards
    story.append(Paragraph("2. Stack Tecnologico, Contratti API & Pattern Ingegneristici", section_heading))
    data_stack = [
        [
            Paragraph("<b>Componente</b>", cell_label),
            Paragraph("<b>Framework, Linguaggi & Librerie</b>", cell_label),
            Paragraph("<b>Caratteristiche Architetturali & Qualità</b>", cell_label)
        ],
        [
            Paragraph("<b>Presentation Tier<br/>(Front-end SPA)</b>", cell_label),
            Paragraph("React 18.3, TypeScript 5.8 (Strict), Vite 5, Tailwind CSS 3.4, Axios, DOMPurify, React Router 7.", cell_value),
            Paragraph("• Single Page Application reattiva con design Neo-Brutalism<br/>• Virtual DOM diffing & Event Delegation sui link Wikipedia<br/>• Sanitizzazione XSS rigorosa con DOMPurify<br/>• <b>Playwright: 19 test E2E automatici passati (100%)</b><br/>• Deploy su Vercel Edge Global CDN", cell_value)
        ],
        [
            Paragraph("<b>Application Tier<br/>(Back-end REST)</b>", cell_label),
            Paragraph("Node.js 24 LTS, Express 5.2, TypeScript, Prisma ORM 7.9, pg.Pool, JWT (HS256), Bcrypt, Zod, Helmet, lru-cache.", cell_value),
            Paragraph("• <b>OpenAPI 3.0 & Swagger UI interattivo (/api/docs)</b><br/>• Pipeline type-codegen automatica (<i>openapi-typescript</i>)<br/>• Anti-Cheat Zero-Trust & Concorrenza Ottimistica (OCC)<br/>• <b>Vitest: 58 test automatici (Unit/Integration) passati (100%)</b><br/>• Deploy containerizzato su Render.com", cell_value)
        ],
        [
            Paragraph("<b>Data Tier<br/>(Database Cloud)</b>", cell_label),
            Paragraph("PostgreSQL 16 Gestito su Supabase (AWS eu-north-1) con Managed Connection Pooler (PgBouncer).", cell_value),
            Paragraph("• Schemi relazionali: User, Game, GameStep<br/>• Transazioni ACID atomiche per prevenire race conditions<br/>• Indici composti B-Tree per ottimizzazione query", cell_value)
        ]
    ]

    t_stack = Table(data_stack, colWidths=[95, 215, 221])
    t_stack.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#FFFFFF')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_stack)
    story.append(Spacer(1, 7))

    # 5. Execution Instructions & Deliverables Compliance
    story.append(Paragraph("3. Istruzioni di Esecuzione & Conformità ai Vincoli di Consegna", section_heading))
    inst_text = (
        "• <b>Avvio Rapido Unificato con Docker Compose:</b> Dalla radice del progetto, eseguire <code>docker compose up --build</code>. "
        "L'intero stack verrà istanziato (Front-end su porta 5173, Back-end su porta 3001 e PostgreSQL locale su porta 5432).<br/>"
        "• <b>Avvio Manuale Locale:</b> In <code>/backend</code> eseguire <code>npm install &amp;&amp; npx prisma db push &amp;&amp; npm run dev</code>; "
        "in <code>/frontend</code> eseguire <code>npm install &amp;&amp; npm run dev</code>. Script contratti: <code>npm run codegen</code>.<br/>"
        "• <b>Conformità ai Requisiti Didattici (Sez. 5):</b> L'archivio ZIP <code>N86004677-Luca-Barrella.zip</code> contiene unicamente "
        "il codice sorgente (cartelle <code>/backend</code> e <code>/frontend</code>), il file <code>README.md</code> operativo, la specifica <code>openapi.json</code> "
        "e la presente scheda PDF sintetica di <b>1 singola pagina</b>, escludendo rigorosamente cartelle <i>node_modules</i> e build artifacts."
    )
    story.append(Paragraph(inst_text, body_style))

    doc.build(story)
    print(f"✅ PDF generated successfully at: {output_path}")

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'doc_consegna.pdf'
    create_delivery_pdf(out)
