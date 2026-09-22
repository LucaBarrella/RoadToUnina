import os
import re
import html
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, Preformatted
)
from reportlab.pdfgen import canvas

DOCS_DIR = "docs"
MD_FILE = os.path.join(DOCS_DIR, "RoadToUnina-Manuale-Completo.md")
PDF_FILE = os.path.join(DOCS_DIR, "RoadToUnina-Manuale-Completo.pdf")

class NumberedCanvas(canvas.Canvas):
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
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return  # Frontespizio pulito
        
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor('#64748B'))
        
        # Header superiore
        self.drawString(45, 805, "RoadToUnina — Architettura, Ingegnerizzazione e Guida all'Esame")
        self.drawRightString(550, 805, "Corso di Tecnologie Web (A.A. 2025/2026)")
        self.setStrokeColor(colors.HexColor('#CBD5E1'))
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
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'<u><font color="#0284C7">\1</font></u>', text)

    for idx, code_content in enumerate(code_matches):
        safe_code = html.escape(code_content)
        text = text.replace(f"___CODE_{idx}___", f'<font name="Courier" color="#0369A1">{safe_code}</font>')

    return text

def chunk_code_lines(lines, chunk_size=40):
    """Splits long code blocks into smaller chunks to prevent Table overflow on single pages."""
    for j in range(0, len(lines), chunk_size):
        yield lines[j:j+chunk_size]

def build_pdf():
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
        textColor=colors.HexColor('#0F172A'),
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
        textColor=colors.HexColor('#1E293B'),
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
        textColor=colors.HexColor('#0369A1'),
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
        textColor=colors.HexColor('#334155'),
        spaceAfter=5
    )

    bullet_style = ParagraphStyle(
        'CustomBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
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
        textColor=colors.HexColor('#0F172A')
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
                        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
                        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
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

        if not stripped:
            i += 1
            continue

        if stripped == '---':
            story.append(Spacer(1, 3))
            story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E2E8F0'), spaceBefore=2, spaceAfter=5))
            story.append(Spacer(1, 3))
            i += 1
            continue

        if stripped.startswith('# '):
            title = stripped[2:].strip()
            if title.startswith('Capitolo') and len(story) > 10:
                story.append(PageBreak())
            p = Paragraph(clean_inline_formatting(title), h1_style)
            story.append(p)
            i += 1
            continue

        if stripped.startswith('## '):
            title = stripped[3:].strip()
            p = Paragraph(clean_inline_formatting(title), h2_style)
            story.append(p)
            i += 1
            continue

        if stripped.startswith('### '):
            title = stripped[4:].strip()
            p = Paragraph(clean_inline_formatting(title), h3_style)
            story.append(p)
            i += 1
            continue

        if stripped.startswith('#### '):
            title = stripped[5:].strip()
            p = Paragraph(f"<b>{clean_inline_formatting(title)}</b>", h3_style)
            story.append(p)
            i += 1
            continue

        if stripped.startswith(('- ', '* ', '• ')):
            bullet_text = stripped[2:].strip()
            p = Paragraph(f"• {clean_inline_formatting(bullet_text)}", bullet_style)
            story.append(p)
            i += 1
            continue

        num_match = re.match(r'^(\d+\.)\s(.*)', stripped)
        if num_match:
            prefix = num_match.group(1)
            text = num_match.group(2)
            p = Paragraph(f"<b>{prefix}</b> {clean_inline_formatting(text)}", bullet_style)
            story.append(p)
            i += 1
            continue

        p = Paragraph(clean_inline_formatting(stripped), body_style)
        story.append(p)
        i += 1

    print("⚙️ Compilazione del documento PDF con NumberedCanvas...")
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"🎉 Compilazione terminata con successo! PDF creato in: {PDF_FILE}")

if __name__ == '__main__':
    build_pdf()
