#!/usr/bin/env bash
set -euo pipefail

MATRICOLA="N86004677"
STUDENT_NAME="Luca-Barrella"
ARCHIVE_NAME="${MATRICOLA}-${STUDENT_NAME}.zip"
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMP_DIR="$(mktemp -d -t roadtounina_consegna_XXXXXX)"

echo "🚀 [1/5] Inizio preparazione pacchetto formale di consegna..."
echo "📂 Workspace: ${WORKSPACE_DIR}"
echo "📦 Archivio target: ${ARCHIVE_NAME}"
echo "📁 Cartella staging temporanea: ${TEMP_DIR}"

# 1. Genera / Aggiorna PDF di consegna
echo "📄 [2/5] Generazione doc_consegna.pdf (ReportLab)..."
python3 "${WORKSPACE_DIR}/generate_doc.py" "${WORKSPACE_DIR}/doc_consegna.pdf"

# 2. Copia dei 4 elementi richiesti tassativamente dalla Sezione 5
echo "📋 [3/5] Preparazione cartella pulita (Sezione 5 REQUIREMENTS.md)..."
STAGE_DIR="${TEMP_DIR}/${MATRICOLA}-${STUDENT_NAME}"
mkdir -p "${STAGE_DIR}"

# Elemento 1: doc_consegna.pdf
cp "${WORKSPACE_DIR}/doc_consegna.pdf" "${STAGE_DIR}/"

# Elemento 2: README.md
cp "${WORKSPACE_DIR}/README.md" "${STAGE_DIR}/"

# Elemento 3: /backend pulito
echo "   -> Copia backend (esclusi node_modules, dist, .env privati, dev.db, ecc.)..."
rsync -av \
  --exclude="node_modules" \
  --exclude="dist" \
  --exclude=".env" \
  --exclude=".env.local" \
  --exclude="dev.db" \
  --exclude="dev.db*" \
  --exclude=".DS_Store" \
  --exclude="._*" \
  --exclude="*.log" \
  --exclude=".system_generated" \
  "${WORKSPACE_DIR}/backend" "${STAGE_DIR}/"

# Elemento 4: /frontend pulito
echo "   -> Copia frontend (esclusi node_modules, dist, playwrigth cache, .env privati, ecc.)..."
rsync -av \
  --exclude="node_modules" \
  --exclude="dist" \
  --exclude=".env" \
  --exclude=".env.local" \
  --exclude="playwright-report" \
  --exclude="test-results" \
  --exclude=".DS_Store" \
  --exclude="._*" \
  --exclude="*.log" \
  "${WORKSPACE_DIR}/frontend" "${STAGE_DIR}/"

# Copia facoltativa ma preziosa per docker compose: docker-compose.yml nella root
if [ -f "${WORKSPACE_DIR}/docker-compose.yml" ]; then
  cp "${WORKSPACE_DIR}/docker-compose.yml" "${STAGE_DIR}/"
fi

# 3. Pulizia maniacale dei metadati macOS (__MACOSX, .DS_Store, ._*)
echo "🧹 [4/5] Rimozione metadati macOS, attributi estesi e file nascosti indesiderati..."
find "${STAGE_DIR}" -name ".DS_Store" -delete || true
find "${STAGE_DIR}" -name "._*" -delete || true
find "${STAGE_DIR}" -type d -name "__MACOSX" -exec rm -rf {} + 2>/dev/null || true
# Rimuove attributi estesi di Apple (quarantine, ResourceForks)
xattr -rc "${STAGE_DIR}" 2>/dev/null || true

# 4. Creazione archivio ZIP con disattivazione dei metadati Apple
echo "🗜️ [5/5] Compressione in ${ARCHIVE_NAME}..."
cd "${TEMP_DIR}"
export COPYFILE_DISABLE=1
zip -r -q -X "${WORKSPACE_DIR}/${ARCHIVE_NAME}" "${MATRICOLA}-${STUDENT_NAME}"

# Cleanup staging
rm -rf "${TEMP_DIR}"

echo "================================================================="
echo "✅ ARCHIVIO CREATO CON SUCCESSO: ${WORKSPACE_DIR}/${ARCHIVE_NAME}"
echo "📏 Dimensione:" $(du -h "${WORKSPACE_DIR}/${ARCHIVE_NAME}" | cut -f1)
echo "================================================================="
