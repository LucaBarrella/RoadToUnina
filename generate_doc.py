import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

def create_delivery_pdf(output_path):
    # Setup document with exact 1-page margins
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0F172A'),
        alignment=1
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#475569'),
        alignment=1
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1E293B'),
        spaceAfter=4
    )
    
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#334155')
    )

    cell_label = ParagraphStyle(
        'CellLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1E293B')
    )

    cell_value = ParagraphStyle(
        'CellValue',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155')
    )

    story = []

    # Header section
    story.append(Paragraph("UNIVERSITÀ DEGLI STUDI DI NAPOLI FEDERICO II", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Corso di Laurea in Informatica — Corso di Tecnologie Web (A.A. 2025/2026)", subtitle_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("Docente: Prof. Luigi Libero Lucio Starace, Ph.D.", subtitle_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#0284C7'), spaceBefore=2, spaceAfter=10))

    # Student & Project Details Table
    data_info = [
        [Paragraph("Studente:", cell_label), Paragraph("Luca Barrella", cell_value),
         Paragraph("Matricola:", cell_label), Paragraph("N86004677", cell_value)],
        [Paragraph("Traccia:", cell_label), Paragraph("Traccia 4.C — WEBTECH'S ROADTOUNINA", cell_value),
         Paragraph("Data Consegna:", cell_label), Paragraph("Settembre 2026", cell_value)],
        [Paragraph("Demo Live Frontend:", cell_label), Paragraph('<font color="#0284C7"><u>https://road-to-unina.vercel.app</u></font>', cell_value),
         Paragraph("Backend API REST:", cell_label), Paragraph('<font color="#0284C7"><u>https://roadtounina-backend.onrender.com/api</u></font>', cell_value)],
    ]

    t_info = Table(data_info, colWidths=[110, 160, 90, 162])
    t_info.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_info)
    story.append(Spacer(1, 12))

    # Architecture Overview
    story.append(Paragraph("1. Sintesi del Progetto & Architettura", section_heading))
    desc_text = (
        "<b>RoadToUnina</b> è una piattaforma web full-stack per speedrun enciclopedici su Wikipedia Italia. "
        "Gli utenti registrati avviano una sessione partendo da una voce casuale (MediaWiki API) e devono raggiungere "
        "la pagina obiettivo <i>'Università degli Studi di Napoli Federico II'</i> navigando solo attraverso i link interni validi. "
        "L'applicazione applica un rigoroso sistema <b>Anti-Cheat server-side</b>, persistenza completa dello stato "
        "su PostgreSQL per il ripristino cross-device, concorrenza ottimistica (OCC) per evitare race condition, "
        "e consultazione pubblica di statistiche e leaderboard per ospiti e utenti autenticati."
    )
    story.append(Paragraph(desc_text, body_style))
    story.append(Spacer(1, 10))

    # Stacks Table
    story.append(Paragraph("2. Stack Tecnologico & Standard Implementativi", section_heading))
    data_stack = [
        [
            Paragraph("<b>Componente</b>", cell_label),
            Paragraph("<b>Linguaggi, Framework & Strumenti</b>", cell_label),
            Paragraph("<b>Caratteristiche & Testing</b>", cell_label)
        ],
        [
            Paragraph("<b>Back-end REST API</b>", cell_label),
            Paragraph("Node.js, Express.js 5, TypeScript (strict mode), Prisma ORM, pg.Pool (connection pool), JWT (HMAC SHA-256), Bcrypt, Helmet, CORS, Zod, lru-cache.", cell_value),
            Paragraph("• Architettura Layered (Router, Controller, Service)<br/>• Anti-Cheat & OCC Concurrency (HTTP 409)<br/>• <b>Vitest: 53 test automatici passati (100%)</b><br/>• Container Docker multi-stage & Render.com", cell_value)
        ],
        [
            Paragraph("<b>Front-end SPA</b>", cell_label),
            Paragraph("React 18, Vite, TypeScript, Tailwind CSS, DOMPurify, Axios, React Router, Lucide Icons.", cell_value),
            Paragraph("• Design Neo-Brutalism responsive con Dark Mode<br/>• Virtual DOM diffing & Event Delegation<br/>• <b>Playwright: 19 test E2E passati (100%)</b><br/>• Deploy globale edge su Vercel CDN", cell_value)
        ],
        [
            Paragraph("<b>Database Layer</b>", cell_label),
            Paragraph("PostgreSQL su Supabase Cloud (Managed Connection Pool con PgBouncer).", cell_value),
            Paragraph("• Modelli relazionali: User, Game, GameStep<br/>• Transazioni ACID atomiche con rollback", cell_value)
        ]
    ]

    t_stack = Table(data_stack, colWidths=[100, 230, 192])
    t_stack.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#FFFFFF')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_stack)
    story.append(Spacer(1, 10))

    # Instructions section
    story.append(Paragraph("3. Istruzioni di Avvio Rapido & Conformità", section_heading))
    inst_text = (
        "<b>Avvio locale unificato via Docker Compose:</b> <code>docker compose up --build</code> "
        "(avvia automaticamente Front-end su porta 5173, Back-end su porta 3001 e PostgreSQL su porta 5432). "
        "Per popolare il database con dati di test: <code>cd backend &amp;&amp; npm run seed</code>.<br/>"
        "<b>Conformità ai requisiti didattici (Sez. 5):</b> L'archivio di consegna include esclusivamente la cartella "
        "<code>/backend</code>, la cartella <code>/frontend</code>, il presente <code>doc_consegna.pdf</code> e il <code>README.md</code>, "
        "con totale esclusione di <i>node_modules</i>, build artifacts e file temporanei."
    )
    story.append(Paragraph(inst_text, body_style))

    doc.build(story)
    print(f"✅ PDF generated successfully at: {output_path}")

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'doc_consegna.pdf'
    create_delivery_pdf(out)
