import os
import re
import html
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Preformatted
)
from reportlab.pdfgen import canvas

DOCS_DIR = "docs"
MD_FILE = os.path.join(DOCS_DIR, "RoadToUnina-Manuale-Completo.md")
PDF_FILE = os.path.join(DOCS_DIR, "RoadToUnina-Manuale-Completo-Dark.pdf")

# Dark Palette (Mini-LED / OLED optimized: pitch dark background, low-power emission)
BG_COLOR = colors.HexColor('#090D16')        # Deep OLED Navy / Black
HEADER_LINE = colors.HexColor('#1E293B')    # Muted dark border
TEXT_MUTED = colors.HexColor('#94A3B8')     # Slate 400
TEXT_MAIN = colors.HexColor('#E2E8F0')      # Slate 200 (high contrast, zero glare)
HEADING_1 = colors.HexColor('#38BDF8')      # Sky 400
HEADING_2 = colors.HexColor('#FACC15')      # Neo Yellow / Amber 400
HEADING_3 = colors.HexColor('#34D399')      # Emerald 400
CODE_BG = colors.HexColor('#0F172A')        # Dark Slate Box
CODE_BORDER = colors.HexColor('#334155')    # Slate 700
CODE_TEXT = colors.HexColor('#38BDF8')      # Cyan / Sky Code text
QUOTE_BG = colors.HexColor('#131D31')       # Subtle Blue Tint
QUOTE_BAR = colors.HexColor('#38BDF8')      # Sky Left Bar

class DarkNumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_dark_background()
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_dark_background(self):
        self.saveState()
        self.setFillColor(BG_COLOR)
        # Cover full A4 page
        self.rect(0, 0, 595.27, 841.89, fill=1, stroke=0)
        self.restoreState()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return  # Frontespizio pulito
        
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(TEXT_MUTED)
        
        # Header superiore
        self.drawString(45, 805, "RoadToUnina — Architettura, Ingegnerizzazione e Guida all'Esame (Dark Mode)")
        self.drawRightString(550, 805, "Corso di Tecnologie Web (A.A. 2025/2026)")
        self.setStrokeColor(HEADER_LINE)
        self.setLineWidth(0.5)
        self.line(45, 800, 550, 800)

        # Footer inferiore
        self.line(45, 45, 550, 45)
        self.drawString(45, 33, "Candidato: Luca Barrella (N86004677) | Docente: Prof. L.L.L. Starace")
        self.drawRightString(550, 33, f"Pagina {self._pageNumber} di {page_count}")
        self.restoreState()

def clean_inline_formatting(text):
    code_matches = []
    def code_repl(m):
        code_matches.append(m.group(1))
        return f"___CODE_{len(code_matches)-1}___"
    
    text = re.sub(r'`([^`]+)`', code_repl, text)
    text = html.escape(text)

    # Bold **...**
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    # Italic *...*
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<i>\1</i>', text)
    # Links [label](url)
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'<u><font color="#38BDF8">\1</font></u>', text)

    for idx, code_content in enumerate(code_matches):
        safe_code = html.escape(code_content)
        text = text.replace(f"___CODE_{idx}___", f'<font name="Courier" color="#38BDF8">{safe_code}</font>')

    return text

def chunk_code_lines(lines, chunk_size=40):
    """Splits long code blocks into smaller chunks to prevent Table overflow on single pages."""
    for j in range(0, len(lines), chunk_size):
        yield lines[j:j+chunk_size]

def build_dark_pdf():
    print(f"📖 Lettura del markdown sorgente: {MD_FILE}")
    with open(MD_FILE, "r", encoding="utf-8") as f:
        md_text = f.read()

    doc = SimpleDocTemplate(
        PDF_FILE,
        pagesize=A4,
        leftMargin=45,
        rightMargin=45,
        topMargin=50,
        bottomMargin=55
    )

    styles = getSampleStyleSheet()

    h1_style = ParagraphStyle(
        'ChapHeading1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=HEADING_1,
        spaceBefore=14,
        spaceAfter=10,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'ChapHeading2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=HEADING_2,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    h3_style = ParagraphStyle(
        'ChapHeading3',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=HEADING_3,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=TEXT_MAIN,
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'CustomBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=TEXT_MAIN,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=3
    )

    code_block_style = ParagraphStyle(
        'PreformattedCode',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7,
        leading=9.2,
        textColor=CODE_TEXT
    )

    quote_style = ParagraphStyle(
        'CustomQuote',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8.5,
        leading=13,
        textColor=colors.HexColor('#BAE6FD')
    )

    story = []

    lines = md_text.split('\n')
    i = 0
    in_code_block = False
    code_lines = []

    while i < len(lines):
        line = lines[i]

        if line.strip().startswith('```'):
            if in_code_block:
                in_code_block = False
                # Chunk long code blocks so ReportLab tables can span across pages
                for chunk in chunk_code_lines(code_lines, chunk_size=40):
                    raw_code = '\n'.join(chunk)
                    pre_code = Preformatted(raw_code, code_block_style, maxLineLength=95)
                    
                    t_code = Table([[pre_code]], colWidths=[505])
                    t_code.setStyle(TableStyle([
                        ('BACKGROUND', (0,0), (-1,-1), CODE_BG),
                        ('BOX', (0,0), (-1,-1), 1, CODE_BORDER),
                        ('TOPPADDING', (0,0), (-1,-1), 4),
                        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                        ('LEFTPADDING', (0,0), (-1,-1), 6),
                        ('RIGHTPADDING', (0,0), (-1,-1), 6),
                    ]))
                    story.append(Spacer(1, 3))
                    story.append(t_code)
                    story.append(Spacer(1, 3))
                code_lines = []
            else:
                in_code_block = True
                code_lines = []
            i += 1
            continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        stripped = line.strip()

        if '<div style="page-break-after: always;"></div>' in stripped or stripped == '\\newpage':
            story.append(PageBreak())
            i += 1
            continue

        if stripped == '---':
            story.append(Spacer(1, 4))
            story.append(Table([['']], colWidths=[505], style=[('LINEABOVE', (0,0), (-1,-1), 0.5, HEADER_LINE)]))
            story.append(Spacer(1, 4))
            i += 1
            continue

        if not stripped:
            story.append(Spacer(1, 2))
            i += 1
            continue

        if stripped.startswith('# '):
            text = clean_inline_formatting(stripped[2:].strip())
            story.append(Paragraph(text, h1_style))
            i += 1
            continue
        elif stripped.startswith('## '):
            text = clean_inline_formatting(stripped[3:].strip())
            story.append(Paragraph(text, h2_style))
            i += 1
            continue
        elif stripped.startswith('### '):
            text = clean_inline_formatting(stripped[4:].strip())
            story.append(Paragraph(text, h3_style))
            i += 1
            continue
        elif stripped.startswith('#### '):
            text = clean_inline_formatting(stripped[5:].strip())
            h4_style = ParagraphStyle('H4', parent=h3_style, fontSize=9.5, leading=12, textColor=colors.HexColor('#F472B6'))
            story.append(Paragraph(text, h4_style))
            i += 1
            continue

        if stripped.startswith('> '):
            quote_content = []
            while i < len(lines) and lines[i].strip().startswith('> '):
                quote_content.append(lines[i].strip()[2:])
                i += 1
            full_quote = ' '.join(quote_content)
            p_quote = Paragraph(clean_inline_formatting(full_quote), quote_style)
            t_quote = Table([[p_quote]], colWidths=[505])
            t_quote.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), QUOTE_BG),
                ('LEFTPADDING', (0,0), (-1,-1), 10),
                ('RIGHTPADDING', (0,0), (-1,-1), 8),
                ('TOPPADDING', (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 5),
                ('LINEBEFORE', (0,0), (-1,-1), 3, QUOTE_BAR),
            ]))
            story.append(Spacer(1, 3))
            story.append(t_quote)
            story.append(Spacer(1, 3))
            continue

        if stripped.startswith('- ') or stripped.startswith('* ') or re.match(r'^\d+\.\s', stripped):
            bullet_char = "•"
            content = stripped
            if stripped.startswith('- ') or stripped.startswith('* '):
                content = stripped[2:]
            else:
                m = re.match(r'^(\d+\.)\s*(.*)', stripped)
                if m:
                    bullet_char = m.group(1)
                    content = m.group(2)
            
            clean_text = clean_inline_formatting(content)
            story.append(Paragraph(f"{bullet_char} {clean_text}", bullet_style))
            i += 1
            continue

        clean_text = clean_inline_formatting(stripped)
        story.append(Paragraph(clean_text, body_style))
        i += 1

    print("⚙️ Compilazione del documento PDF Dark Mode con DarkNumberedCanvas...")
    doc.build(story, canvasmaker=DarkNumberedCanvas)
    print(f"🎉 Compilazione terminata con successo! PDF Dark Mode creato in: {PDF_FILE}")

if __name__ == '__main__':
    build_dark_pdf()
