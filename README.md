# IAdvisors Bayer

Aplicación full-stack que permite a los equipos de Bayer/Merkle evaluar y controlar conversaciones generadas con OpenAI, gestionar múltiples marcas y monitorear indicadores de recomendación. El proyecto combina un frontend en React + Ant Design con un backend en Node.js + Express, almacenamiento local SQLite y llamadas a la API de OpenAI para asistentes, vector stores y mediciones automatizadas.

## Tabla de contenidos
- [Resumen rápido](#resumen-rápido)
- [Arquitectura de la solución](#arquitectura-de-la-solución)
- [Directorios clave](#directorios-clave)
- [Variables de entorno](#variables-de-entorno)
- [Base de datos y persistencia](#base-de-datos-y-persistencia)
- [API principal](#api-principal)
- [Frontend](#frontend)
- [Métricas automatizadas](#métricas-automatizadas)
- [Puesta en marcha local](#puesta-en-marcha-local)
- [Ejecución con Docker](#ejecución-con-docker)
- [Recursos adicionales](#recursos-adicionales)

## Resumen rápido
- **Casos principales**: registro/login de usuarios, chat con hilos multi-marca, subida de archivos al vector store, panel de reportes, seguimiento de acciones (follow-ups), dashboard público y módulo administrativo para usuarios, marcas y asistente.
- **Stack**: React 19 + Vite + Ant Design en el frontend; Express 5 + Better SQLite 3 + OpenAI SDK en el backend.
- **Persistencia local**: base SQLite (`iadvisors.db`) con tablas para usuarios, marcas, hilos, mensajes, reportes, follow-ups y mediciones.
- **Multimarca**: todas las operaciones autenticadas se ejecutan en el contexto de una marca seleccionada y propagada mediante el header `x-brand-id` definido por el `BrandContext` del frontend.
- **Integraciones externas**: API de OpenAI para asistentes, vector stores, files y responses; credenciales de AWS pre-configuradas en `.env` para los despliegues gestionados por el equipo de infraestructura.
- **Seguridad**: contraseñas con PBKDF2, sesiones persistidas en `localStorage`, soporte para roles (`user`, `manager`, `admin`) y filtro de reportes/seguimientos por usuario.

## Arquitectura de la solución

### Flujo general
1. El usuario se registra o inicia sesión mediante `/api/users` y el frontend guarda la sesión en `localStorage`.
2. Tras autenticarse, el `BrandContext` selecciona una marca asignada y envía el ID en `x-brand-id` en cada llamada.
3. El chat crea/recupera hilos en SQLite y sincroniza mensajes con la API de OpenAI (assistants + vector store).
4. Las cargas de archivos pasan por `multer`, se suben al vector store de la marca y quedan disponibles para futuras respuestas.
5. Los reportes, follow-ups y paneles administrativos se alimentan de las tablas locales.
6. Un job de `node-cron` ejecuta mediciones periódicas para cada marca y registra resultados agregados.

### Componentes
- **Frontend (`client/`)**: React 19 + Vite 7 con contexts para autenticación, marca y tema; UI basada en Ant Design; rutas protegidas (`ProtectedRoute`, `AdminRoute`) y páginas específicas para chat, vector store, reportes, dashboard, seguimiento y administración.
- **Backend (`server/`)**: Express 5 con routers modulares para usuarios, chat, archivos, reportes, admin, mediciones, follow-ups, dashboard público y marcas. Usa `multer` para uploads, `node-cron` para jobs y `openai` SDK para hilos, archivos y mediciones.
- **Base de datos**: `better-sqlite3` con migraciones automáticas al inicio (`server/src/db.js`). Los IDs se generan con `uuid.v4`.
- **Servicios externos**:
 - **OpenAI**: `client.beta.threads.*`, `client.vectorStores.*`, `client.responses.create` y `client.models.list`.
  - **AWS IAM**: las credenciales se cargan vía `.env` para los despliegues que integran servicios AWS (actualmente solo se almacenan y documentan).
  - **Archivos locales**: cargas temporales en `/tmp` para imágenes del chat y documentos del vector store.

## Arquitectura en AWS (pre-productivo)
- **Frontend**: el build de Vite se sirve desde un bucket S3 privado y se distribuye mediante CloudFront (certificado por defecto; ACM aplica si se configura un dominio propio).
- **Backend**: contenedor de Node.js/Express ejecutado en ECS Fargate detrás de un Application Load Balancer público (HTTP; CloudFront sirve HTTPS al cliente). Health checks en `/health`.
- **Datos**: Aurora PostgreSQL Serverless v2 (Multi-AZ) + RDS Proxy están aprovisionados para reemplazar a SQLite, pero la aplicación debe migrarse/activarse explícitamente para usar Postgres en runtime. AWS Backup gestiona snapshots de Aurora.
- **Soporte**: Secrets Manager/Parameter Store reemplazan las `.env` en runtime, CloudWatch recopila logs y alarmas, y EventBridge/ECS Scheduled Tasks ejecutan las mediciones automáticas.
- **Seguridad**: VPC con subredes públicas/privadas, NAT Gateway para salidas hacia OpenAI, WAF/Shield opcionales y roles IAM por servicio.

El diseño completo con diagramas lógicos, flujo de datos y recomendaciones de costos se documenta en `ARCHITECTURE.md`. La guía operativa del entorno AWS pre-productivo (inventario de recursos, comandos y troubleshooting) está en `AWS.md`.

### Checklist previo a producción
- Congelar la infraestructura con IaC (VPC, ECS, Aurora) y validar escalamiento automático.
- Completar la migración de datos SQLite → Aurora PostgreSQL y definir backups/exportaciones.
- Cerrar pendientes de seguridad (rotación de secretos, WAF, accesos IAM mínimos).
- Configurar observabilidad (CloudWatch dashboards/alarms, runbooks) y pruebas de carga/end-to-end.
- Documentar ventana de release, plan de rollback y equipo de soporte.

Consulta la sección “Checklist de alistamiento para producción” en `ARCHITECTURE.md` para la lista exhaustiva.

## Directorios clave

| Ruta | Descripción |
| --- | --- |
| `client/` | Frontend React + Vite (contextos globales, páginas y componentes Ant Design). |
| `server/` | Backend Express, base SQLite, servicios de OpenAI y procesos cron. |
| `server/src/routes/` | Routers agrupados por dominio (usuarios, chat, archivos, admin, etc.). |
| `server/src/services/` | Lógica de conversación y mediciones (`assistantService`, `recommendationMeasurementService`). |
| `server/src/data/` | Datos estáticos como los perfiles/arquetipos de comunicación para el asistente. |
| `docker-compose.yml` | Orquestación de los contenedores `server` y `client`, con volumen persistente para la base. |
| `server/.env.example` | Referencia de las variables de entorno mínimas para el backend. |

## Variables de entorno

### Backend (`server/.env`)

| Variable | Descripción | Obligatoria | Ejemplo / Valor por defecto |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | API key con permisos para assistants, vector stores y responses. | Sí | `sk-...` |
| `OPENAI_ASSISTANT_ID` | Asistente principal usado cuando no se define uno por marca. | Sí | `asst_xxxxxxxxxxxxxxxxxxxxx` |
| `OPENAI_VECTOR_STORE_ID` | Vector store global usado como fallback. | Sí | `vs_xxxxxxxxxxxxxxxxxxxxxxxx` |
| `OPENAI_MEASUREMENT_MODEL` | Modelo default para mediciones si la marca no especifica uno. | No | `gpt-4o-mini` |
| `DEFAULT_BRAND_ID` / `DEFAULT_BRAND_NAME` / `DEFAULT_BRAND_SLUG` | Configuración inicial de la primera marca creada automáticamente. | Sí | `gynocanesten`, `Gynocanestén`, `gynocanesten` |
| `DEFAULT_BRAND_ASSISTANT_ID` / `DEFAULT_BRAND_VECTOR_STORE_ID` | Identificadores del asistente y vector store asociados a la marca por defecto. | Sí | `asst_...`, `vs_...` |
| `DEFAULT_BRAND_MEASUREMENT_MODEL` / `DEFAULT_BRAND_MEASUREMENT_SAMPLE_SIZE` / `DEFAULT_BRAND_MEASUREMENT_CRON` | Configuran las mediciones por marca (modelo, muestras diarias y cron). | No | Modelo `gpt-4o-mini`, muestras `100`, cron `0 6 * * *` |
| `MEASUREMENT_SAMPLE_SIZE` / `MEASUREMENT_CRON` | Valores globales usados como fallback para todas las marcas. | No | `100`, `0 6 * * *` |
| `PORT` | Puerto HTTP del backend. | No | `5001` |
| `DATABASE_PATH` | Ruta para el archivo SQLite. | No | `./iadvisors.db` |
| `AWS_IAM_USERNAME` | Usuario IAM usado en despliegues de infraestructura. | Sí | `usuario@empresa.com` |
| `AWS_ACCESS_KEY_ID` | Access key asociada al usuario IAM. | Sí | `AKIAxxxxxxxxxxxxxxx` |
| `AWS_SECRET_ACCESS_KEY` | Llave secreta IAM (mantener solo en `.env` local). | Sí | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYxxxxxxxx` |
| `AWS_ACCESS_KEY_STATUS` | Estado de la access key (auditoría interna). | Sí | `Active` |
| `AWS_ACCESS_KEY_CREATE_DATE` | Fecha de creación de la access key. | Sí | `2025-12-02T15:14:24+00:00` |
| `DISABLE_MEASUREMENT_JOB` | Ajusta a `true` para omitir el cron programado en entornos locales. | No | `false` |

> Mantén las credenciales reales únicamente en `.env` locales o inyectadas en el entorno de ejecución. Nunca se versionan archivos `.env` reales.

### Frontend (`client/.env` opcional)

| Variable | Descripción | Obligatoria | Valor por defecto |
| --- | --- | --- | --- |
| `VITE_API_BASE` | URL base usada por Axios (`/api` en modo proxy). | No | `/api` |
| `VITE_API_PROXY` | Destino que Vite usa para proxyear `/api` durante `npm run dev`. | No | `http://localhost:5001` |

## Base de datos y persistencia

La base `iadvisors.db` vive en `server/` (o en `/app/data` cuando se usa Docker) y se crea automáticamente con migraciones idempotentes. Tablas principales:

| Tabla | Uso |
| --- | --- |
| `brands` | Configuración por marca: asistente, vector store, prompts y parámetros de medición. |
| `users` | Nombre, correo, `password_hash` (PBKDF2) y rol. |
| `user_brands` | Relación muchos-a-muchos usuario ↔ marca con bandera de marca predeterminada. |
| `threads` | Hilos de conversación (ID local + `openai_thread_id`, título, `brand_id`). |
| `messages` | Historial de cada hilo, incluye `display_metadata` y `openai_message_id`. |
| `reports` | Incidentes levantados sobre mensajes, con estado/resolución y referencias a usuarios. |
| `followups` | Planes de acción luego de una conversación (plataforma, fechas, estado). |
| `recommendation_measurements` | Resultados del job automático que evalúa qué marca se recomienda en cada prompt. |

Indices adicionales (`idx_user_brands_*`, `idx_messages_*`, etc.) optimizan filtros por marca/usuario/reportes. Cualquier cambio en el modelo de datos debe reflejarse en `server/src/db.js` para mantener las migraciones automáticas.

## API principal

> Todas las rutas (excepto `/health`, `/api/users/*` y `/api/brands` públicos) requieren el header `x-brand-id` con una marca válida asociada al usuario autenticado.

- **`/api/users`**: registro (`POST /register`), login (`POST /login`), asignación inicial de contraseña (`POST /set-password`), cambio de contraseña (`POST /change-password`), actualización de perfil (`PUT /:userId`) y consulta (`GET /:userId`).
- **`/api/chat`**: historial (`GET /:userId/history`), lista/creación/renombrado de hilos, envío de mensajes (`POST /message` con texto + imagen ≤ 6 MB), listado de mensajes por hilo y consulta de perfiles de comunicación (`GET /communication-profiles`).
- **`/api/files`**: lista el vector store de la marca, sube archivos (PDF, DOC, TXT, CSV) a OpenAI y permite eliminarlos.
- **`/api/reports`**: creación de reportes sobre respuestas, listado filtrado por rol, resolución y eliminación (con controles de permisos).
- **`/api/measurements`**: resumen histórico (`GET /summary`) y ejecución manual del job de mediciones (`POST /run`).
- **`/api/followups`**: CRUD de registros de seguimiento con filtros por fecha, status y dueño; administración restringida por rol.
- **`/api/admin`**: listado de usuarios con estadísticas, creación/edición de roles y marcas asignadas, eliminación de usuarios, consulta de mensajes y ajustes del asistente de OpenAI (modelos, tools, metadata, vector store ids).
- **`/api/public-dashboard`**: métricas agregadas para dashboards con rango de fechas configurable.
- **`/api/brands`**: listado, creación y edición de marcas (ID, slug, asistente y vector store).

Consulta `server/src/routes/*.js` para ver validaciones específicas o nuevas rutas.

## Frontend

- **Contextos globales**:
  - `AuthContext`: gestiona sesión, sincroniza el usuario vía `/api/users/:id`, cambia contraseña y expone `logout`.
  - `BrandContext`: mantiene la marca seleccionada por usuario, persiste la elección en `localStorage` y adjunta `x-brand-id` en cada `axios` request.
  - `ThemeContext`: alterna entre tema claro y oscuro y actualiza estilos CSS.
- **Layout**: `AppLayout` (Ant Design `Layout`) con menú lateral condicional según el rol, selector de marca, toggle de tema y avatar con acceso al perfil. Las rutas están protegidas por `ProtectedRoute` y, para vistas críticas, por `AdminRoute`.
- **Pantallas**:
  - `RegisterPage`: flujo inicial para registro/login con pestañas (incluye “Configurar contraseña”).
  - `ChatPage`: panel de conversaciones, creación/renombrado de hilos, `ChatPanel` con Markdown rendering, selección de formatos de contenido/redes, perfiles de comunicación/arquetipos, adjuntos de imagen y envío de reportes.
  - `VectorStorePage`: integra `FileManager` para subir/borrar archivos en el vector store de la marca.
  - `ReportsPage`: `ReportCenter` para ver y resolver reportes con filtros y permisos sobre cada registro.
  - `FollowUpsPage`: `FollowUpsPanel` con filtros (estado, fecha, dueño), CRUD en modal y control granular por rol.
  - `PublicDashboardPage`: widgets que consumen `/api/public-dashboard` para mostrar métricas por fecha.
  - `RecommendationAnalyticsPage`: panel administrativo para inspeccionar las mediciones agregadas (`/api/measurements/summary`).
  - `AdminUsersPage`, `AdminAssistantPage`, `AdminBrandsPage`: administración de usuarios, afinación del asistente (modelos, tools, metadata, vector store IDs) y gestión de marcas.
- **Integración con la API**: `client/src/api.js` crea una instancia Axios que apunta a `VITE_API_BASE`. Vite proxya `/api` al backend durante `npm run dev` usando `VITE_API_PROXY`.

## Métricas automatizadas

`server/src/services/recommendationMeasurementService.js` ejecuta un job por marca usando `node-cron`:
- Cada marca define prompts (preguntas) y parámetros (`measurement.model`, `sampleSize`, `cron`).
- El job crea requests `client.responses.create` con un esquema JSON obligatorio y normaliza el nombre de la marca devuelta.
- Los resultados se guardan en `recommendation_measurements` y luego se agregan para dashboards (`getMeasurementsDashboard`).
- Usa `DISABLE_MEASUREMENT_JOB=true` para evitar la ejecución automática en ambientes temporales.
- `POST /api/measurements/run` permite ejecutar el job manualmente para un día/marca específicos.

## Puesta en marcha local

1. **Pre-requisitos**: Node.js ≥ 18, npm 10+, Docker opcional (solo si usarás contenedores), y una API key válida de OpenAI.
2. **Configura variables**: copia `server/.env.example` en `server/.env` y completa todos los campos (incluyendo las credenciales de AWS provistas por el equipo de infraestructura).
3. **Instala dependencias**:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```
4. **Inicia el backend**:
   ```bash
   cd server
   npm run dev
   # Expone http://localhost:5001 (ruta base para la API)
   ```
5. **Inicia el frontend** (en otra terminal):
   ```bash
   cd client
   npm run dev
   # Vite abrirá http://localhost:5173 y proxyeará /api -> http://localhost:5001
   ```
6. **Base de datos**: `iadvisors.db` se crea automáticamente. Para reiniciar datos, elimina el archivo (ten en cuenta que esto borra TODAS las conversaciones/usuarios).

## Ejecución con Docker

1. Asegúrate de tener `docker` y `docker compose` instalados.
2. Completa `server/.env` con tus credenciales locales (el archivo se monta en el contenedor `server`).
3. Levanta la pila completa:
   ```bash
   docker compose up -d --build
   ```
   - Frontend: `http://localhost:4173`
   - API: `http://localhost:5001`
   - La base SQLite se ubica en el volumen `server_data` (`/app/data/iadvisors.db`).
4. Monitorea contenedores/logs:
   ```bash
   docker compose ps
   docker compose logs -f server
   docker compose logs -f client
   ```
5. Detén la plataforma:
   ```bash
   docker compose down
   ```

## Despliegue en AWS (pre-productivo)

1. **Infraestructura**: usa el módulo Terraform en `infra/terraform` para crear la VPC (multi-AZ), subredes públicas/privadas, NAT Gateways, buckets S3 (frontend y adjuntos), CloudFront (que enruta `/` → S3 y `/api/*` → ALB), repositorio ECR, ECS Fargate + ALB, Aurora PostgreSQL Serverless v2 con RDS Proxy, Secrets Manager, Parameter Store, CloudWatch (logs/dashboards/alarmas), AWS Backup, WAF y la regla de EventBridge para el job de mediciones.
   ```bash
   cd infra/terraform
   terraform init
   terraform plan -out tfplan
   terraform apply tfplan
   ```
   Define las variables sensibles (`openai_api_key`, `openai_assistant_id`, `openai_vector_store_id`, `brand_catalog`) en un `terraform.tfvars` no versionado. Puedes ajustar la versión del engine de Aurora con `aurora_engine_version` si AWS publica releases futuros. Los outputs mostrarán el dominio de CloudFront, el DNS del ALB, los buckets y el repositorio ECR.
2. **Imagen del backend**: construye el contenedor usando `server/Dockerfile` y publica la imagen con tag `latest` (y opcionalmente el SHA) en el repositorio ECR expuesto por Terraform. Para ECS Fargate usa siempre imágenes `linux/amd64`:
   ```bash
   docker buildx build --platform linux/amd64 -f server/Dockerfile server -t $ECR_REPO:latest --push
   aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --force-new-deployment
   ```
3. **Migración de datos**: ejecuta `npm run migrate:sqlite-to-pg` en `server/` con las variables `PG_CONNECTION_STRING` (o `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) apuntando al endpoint del RDS Proxy. Esto copiará marcas, usuarios, hilos, mensajes, reportes, followups y mediciones desde SQLite hacia Aurora.
   > Aurora vive en subredes privadas; ejecuta el script desde una tarea ECS temporal, un bastion o cualquier host dentro de la VPC.
4. **Secrets en runtime**: el task de ECS inyecta las credenciales de OpenAI (`OPENAI_API_KEY`, `OPENAI_ASSISTANT_ID`, `OPENAI_VECTOR_STORE_ID` y defaults de marca) desde Secrets Manager, además del catálogo de marcas (`BRAND_CATALOG`) y la bandera `DISABLE_MEASUREMENT_JOB` desde Parameter Store (SSM). Los `.env` no se distribuyen en contenedores.
5. **Job de mediciones**: EventBridge ejecuta el task de ECS con el cron definido en `measurement_schedule_expression`. Puedes pausar el job cambiando el parámetro `/iadvisors-bayer-preprod/disable_measurement_job` a `true`.
6. **Frontend**: genera el build con la API apuntando a `/api` (CloudFront lo proxya al ALB) y sincroniza con el bucket indicado por Terraform. La distribución aplica un `viewer-request` function para reescribir rutas SPA a `/index.html` (excepto `/api/*`), evitando que los errores 4xx/5xx de la API se conviertan en HTML.
   ```bash
   cd client
   npm install
   VITE_API_BASE=/api npm run build
   aws s3 sync dist s3://$FRONTEND_BUCKET --delete
   aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths "/*"
   ```

## CI/CD automatizado

- El workflow `.github/workflows/deploy.yml` publica el backend en ECR y fuerza un redeploy en ECS; luego compila el frontend con Vite, sincroniza el artefacto con el bucket S3 del frontend e invalida CloudFront.
- Configura los siguientes **secrets** en GitHub: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ACCOUNT_ID` y `CLOUDFRONT_DISTRIBUTION_ID` (el ID real se obtiene de `terraform output`).
- Declara las **repository variables** (Settings → Variables) para `AWS_REGION`, `PROJECT_NAME`, `ENVIRONMENT`, `ECR_REPOSITORY`, `ECS_CLUSTER`, `ECS_SERVICE` y `FRONTEND_BUCKET` si necesitas valores distintos a los predeterminados.
- El workflow se ejecuta en cada push a `main` o manualmente vía `workflow_dispatch`. Para un lanzamiento blue/green puedes duplicar el servicio ECS y ajustar el target group dentro del mismo pipeline.

## Migración SQLite → Aurora

1. Garantiza que la API esté detenida para evitar escrituras durante la migración.
2. Exporta (o respalda) el archivo `server/iadvisors.db`.
3. Define las variables de PostgreSQL (idealmente usando las credenciales almacenadas en Secrets Manager) y ejecuta:
   ```bash
   cd server
   npm run migrate:sqlite-to-pg
   ```
4. El script crea (si no existen) las tablas en Aurora y realiza inserciones idempotentes (`ON CONFLICT DO NOTHING`). Repite el comando las veces que necesites para sincronizar datos de prueba.
5. Después de validar conteos y relaciones (`SELECT count(*) ...` por tabla), activa el backend apuntando al RDS Proxy. Mantén AWS Backup y snapshots manuales hasta completar la verificación funcional.

## Observabilidad y checklist final

- Verifica las alarmas creadas en CloudWatch (`alb-5xx`, `ecs-cpu`, `aurora-capacity`) y el dashboard `iadvisors-bayer-preprod-observability` para confirmar tráfico, CPU y conexiones.
- WAF se asocia automáticamente al ALB con reglas manejadas (`AWSManagedRulesCommonRuleSet` + rate limiting). Shield Standard ya se incluye en el servicio.
- El checklist de `ARCHITECTURE.md` sigue siendo la referencia para certificados definitivos, pruebas de carga ≥2x, runbooks y coordinación con soporte. Documenta cualquier desviación y abre tareas si es necesario extender reglas WAF, límites de Aurora o estrategias de costo (Spot tasks, escalamiento adicional, etc.).

### Validaciones rápidas

```bash
# Backend directo
curl -I http://$ALB_DNS/health
# Backend a través de CloudFront
curl -I https://$CLOUDFRONT_DOMAIN/api/health
# SPA (HTML)
curl -I https://$CLOUDFRONT_DOMAIN
```

### Problemas frecuentes y cómo evitarlos

- **Caracteres no ASCII**: AWS rechaza descripciones/nombres con tildes; usa ASCII plano en Terraform (security groups, WAF, etc.).
- **Versiones de Aurora**: consulta `aws rds describe-db-engine-versions --engine aurora-postgresql` antes de fijar `aurora_engine_version`.
- **Dashboards de CloudWatch**: cada widget debe declarar `region` y `view`; de lo contrario la API devuelve validaciones 400.
- **Docker multi-arquitectura**: ECS Fargate estándar ejecuta `linux/amd64`; usa `docker buildx` para evitar `CannotPullContainerError`.
- **Front + API**: el build debe usar `VITE_API_BASE=/api` y la distribución CloudFront debe tener el comportamiento `/api/*` apuntando al ALB.
- **Migraciones**: `npm run migrate:sqlite-to-pg` requiere conectividad privada; ejecútalo dentro de la VPC (p.ej. tarea Fargate temporal) y respalda `iadvisors.db` antes de correrlo.
- **Usuarios administradores**: si no existe un `admin`, crea uno ejecutando desde `server/`:
  ```bash
  npm run seed:admin -- --email admin@tu-dominio.com --password "ContraseñaSegura123" --name "Admin Bayer"
  ```
  El script se conecta a la misma base configurada por `DATABASE_PATH`/`PG*` y asigna automáticamente el rol `admin`.

## Recursos adicionales
- `server/src/data/communicationProfiles.js`: catálogo de arquetipos, tonos y subtonos disponibles en el panel de conversación.
- `client/src/data/promptGuides.js` y `client/src/data/promptOptions.js`: definen los formatos de contenido/redes sociales usados para guiar las respuestas del asistente.
- `AGENTS.md`: pautas para contribuir (mantener documentación en español, variables en `.env`, etc.).
- `preview.log`, `Arquetipos y tonos.xlsx` y `V1 Playground Content.xlsx`: materiales de referencia que alimentan los prompt guides.

Actualiza este README cada vez que cambie la arquitectura, se agreguen nuevas rutas o se modifiquen las variables de entorno exigidas por el backend/frontend.
