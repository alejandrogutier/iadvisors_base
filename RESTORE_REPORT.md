# RESTORE REPORT

## Fecha
- 2026-02-17

## Alcance
- Restauracion local forense de /Users/agutie04/ia_advisors_base
- Sin uso de remoto Git
- Preservacion explicita de .env y server/iadvisors.db*

## Hallazgos iniciales
1. No existia metadata Git en raiz (.git ausente).
2. Frontend tenia dependencias inconsistentes y faltaban binarios de build/lint.
3. Habia contaminacion por archivos duplicados '* 2.*', .DS_Store, tfplan y package 2.json.
4. El backend exige OPENAI_* al arranque; para smoke local se uso DISABLE_MEASUREMENT_JOB=true + valores dummy.

## Cuarentena e inventario
- Carpeta de cuarentena: /Users/agutie04/ia_advisors_base/_recovery_quarantine/20260217-102153
- Inventario previo: /Users/agutie04/ia_advisors_base/_recovery_quarantine/20260217-102153/pre_restore_inventory.txt
- Respaldo preservado: /Users/agutie04/ia_advisors_base/_recovery_quarantine/20260217-102153/preserved/.env
- Respaldo preservado: /Users/agutie04/ia_advisors_base/_recovery_quarantine/20260217-102153/preserved/iadvisors.db
- Respaldo preservado: /Users/agutie04/ia_advisors_base/_recovery_quarantine/20260217-102153/preserved/iadvisors.db-shm
- Respaldo preservado: /Users/agutie04/ia_advisors_base/_recovery_quarantine/20260217-102153/preserved/iadvisors.db-wal

## Archivos movidos a cuarentena
- .DS_Store
- client/.DS_Store
- infra/.DS_Store
- server/.DS_Store
- server/package 2.json
- client/src/index 2.css
- infra/terraform/tfplan
- client/dist/assets/index-CEVSf_rA 2.css
- client/dist/bayer-logo 2.png
- client/dist/favicon 2.svg
- client/dist/favicon_merkle 2.png
- client/dist/index 2.html
- client/dist/logo_merkle 2.png
- client/dist/vite 2.svg
- .DS_Store
- client/.DS_Store
- infra/.DS_Store
- server/.DS_Store

## Limpieza aplicada
- Eliminado /Users/agutie04/ia_advisors_base/client/node_modules
- Eliminado /Users/agutie04/ia_advisors_base/server/node_modules
- Eliminado /Users/agutie04/ia_advisors_base/client/dist
- Eliminado /Users/agutie04/ia_advisors_base/infra/terraform/.terraform

## Cambios de configuracion
- Actualizado /Users/agutie04/ia_advisors_base/.gitignore con:
- infra/terraform/tfplan
- infra/terraform/tfplan.*
- server/iadvisors.db-wal
- server/iadvisors.db-shm
- _recovery_quarantine/

## Runtime y dependencias
- Node objetivo usado: v22.20.0
- npm usado: 10.9.3
- Ejecutado npm --prefix /Users/agutie04/ia_advisors_base/server ci
- Ejecutado npm --prefix /Users/agutie04/ia_advisors_base/client ci
- Verificado /Users/agutie04/ia_advisors_base/client/node_modules/.bin/vite
- Verificado /Users/agutie04/ia_advisors_base/client/node_modules/.bin/eslint

## Restauracion de estructura frontend
- Creado /Users/agutie04/ia_advisors_base/client/src/components/layout/AppLayout.jsx
- Creado /Users/agutie04/ia_advisors_base/client/src/components/layout/ProtectedRoute.jsx
- Creado /Users/agutie04/ia_advisors_base/client/src/components/layout/AdminRoute.jsx

## Validaciones ejecutadas
1. npm --prefix /Users/agutie04/ia_advisors_base/client run lint -> FALLA por deuda previa (eslint existente).
2. npm --prefix /Users/agutie04/ia_advisors_base/client run build -> OK.
3. Backend con DISABLE_MEASUREMENT_JOB=true y OPENAI_* dummy -> /health=200 y /api/health=200.
4. Preservacion final verificada: .env y server/iadvisors.db* presentes.

## Git local
- Repositorio inicializado en /Users/agutie04/ia_advisors_base/.git
- Rama activa: codex/recovery-local-20260217
- Remoto: no configurado (intencional)

## Riesgos pendientes antes de AWS
1. El lint del frontend sigue fallando por problemas preexistentes.
2. npm audit reporta vulnerabilidades en client y server.
3. El build reporta chunks grandes (>500kB).
4. Para correr backend fuera de entorno real se requieren OPENAI_* validas o dummy segun contexto.
