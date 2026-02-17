# Reporte de Ejecución - Migración AWS (Bedrock)

Fecha: 2026-02-17

## Cambios implementados

1. Backend migrado de OpenAI a AWS:
   - Chat: `Converse` + `Retrieve` (Bedrock Runtime + Agent Runtime) en `server/src/services/assistantService.js`.
   - Archivos: S3 + registro `brand_documents` + disparo de `StartIngestionJob` en `server/src/routes/files.js`.
   - Mediciones: Bedrock `Converse` en `server/src/services/recommendationMeasurementService.js`.
   - Admin assistant: endpoint compatible `/api/admin/assistant` ahora gestiona `modelId/knowledgeBaseId/guardrail`.
   - Admin usuarios: creación/rol/eliminación sincronizada con Cognito en `server/src/routes/admin.js`.

2. Persistencia y compatibilidad:
   - `server/src/db.js` extendido con campos AWS por marca:
     - `model_id`, `knowledge_base_id`, `knowledge_base_status`, `guardrail_id`, `kb_data_source_id`, `kb_s3_prefix`.
   - Compatibilidad preservada:
     - `assistantId` alias de `modelId`.
     - `vectorStoreId` alias de `knowledgeBaseId`.
   - Nueva tabla `brand_documents`.
   - Script de bootstrap Aurora: `server/scripts/bootstrap_aurora.sql`.

3. Infraestructura (Terraform):
   - Eliminadas referencias OpenAI de runtime e IaC.
   - Agregados recursos y configuración Bedrock/KB:
     - Bucket S3 KB.
     - OpenSearch Serverless vector collection + policies.
     - Rol IAM de Bedrock KB.
     - Variables/env para `AI_PROVIDER=bedrock`, `BEDROCK_*`, `KB_BUCKET`, credenciales `PG*`.
   - Validación: `terraform validate` OK.

4. Frontend (sin romper rutas):
   - `AdminBrandsPanel.jsx`: UI y payloads AWS (`Model ID`, `Knowledge Base`, `Guardrail`, `Data Source`).
   - `AssistantSettingsPanel.jsx`: semántica Bedrock.
   - `FileManager.jsx`: mensajes/estados orientados a KB AWS.

5. Documentación actualizada:
   - `README.md`
   - `AWS.md`
   - `infra/terraform/README.md`
   - `server/.env.example`

## Validaciones ejecutadas

1. `npm --prefix server install` y `npm --prefix server ci` OK.
2. `npm --prefix client ci` OK.
3. `npm --prefix client run build` OK.
4. Backend local:
   - `GET /health` OK (200).
   - `GET /api/health` OK (200).
5. API marcas:
   - `GET /api/brands` OK.
   - `POST /api/brands` OK con respuesta AWS-compatible y aliases.
6. `terraform validate` OK.

## Bloqueo operativo actual

No fue posible ejecutar despliegue ni smoke AWS end-to-end porque las credenciales AWS activas en esta sesión son inválidas:

- `InvalidClientTokenId`
- `InvalidAccessKeyId`

Comandos afectados: `aws sts get-caller-identity`, `aws bedrock ...`, `aws ecs ...`, `aws s3 ...`.

## Pendientes para cierre 100% en AWS

1. Cargar credenciales AWS válidas y reintentar:
   - `aws sts get-caller-identity`
2. Aplicar IaC:
   - `cd infra/terraform && terraform plan && terraform apply`
3. Build/push backend (`linux/amd64`) y redeploy ECS.
4. Deploy frontend S3 + invalidación CloudFront y/o release Amplify.
5. Ejecutar smoke final completo en entorno AWS:
   - health, login Cognito, create brand + KB activa, upload+ingesta, chat texto/imagen, mediciones, CRUD admin users.
