# Arquitectura de despliegue en AWS – IAdvisors Bayer

## Objetivo
Preparar un entorno pre-productivo en AWS capaz de alojar el frontend, la API y todos los datos (usuarios, mensajes, reportes, mediciones) con una configuración segura, escalable y de bajo costo. La arquitectura propuesta aprovecha servicios administrados y capas desacopladas para facilitar evoluciones hacia producción sin rediseños profundos.

## Estado actual (preprod) – auditado 2026-02-13

Este entorno ya está aprovisionado y accesible por el dominio CloudFront. Los puntos siguientes describen lo que está desplegado hoy (no solo lo “ideal”):

- Cuenta AWS: `741448945431` (región principal `us-east-1`).
- CloudFront: distribución `E2ZO7JQ06J9PLY`, dominio `d1jd44v3p51cpx.cloudfront.net`.
- Orígenes CloudFront:
  - S3 (frontend): bucket `iadvisors-bayer-preprod-frontend20251202172221317100000001` con OAC `E1ALTMPLJW2E3V`.
  - ALB (backend): `iadvisors-bayer-preprod-alb-1320845857.us-east-1.elb.amazonaws.com` (origen `http-only`).
- Routing:
  - `/api/*` -> ALB.
  - Rutas SPA -> S3 con un CloudFront Function `iadvisors-bayer-preprod-spa-rewrite` (evento `viewer-request`) para reescribir a `/index.html` sin enmascarar errores de API.
- Backend:
  - ECS Fargate: cluster `iadvisors-bayer-preprod-cluster`, servicio `iadvisors-bayer-preprod-api`, task definition `iadvisors-bayer-preprod-api:2`, contenedor `api` (puerto `5001`).
  - ECR: repositorio `iadvisors-bayer-preprod-api`, se despliega la etiqueta `latest`.
  - ALB listener: HTTP `:80`. Health check del target group `iadvisors-bayer-preprod-tg` en `/health` (puerto `5001`).
- Datos:
  - Aurora PostgreSQL Serverless v2: cluster `iadvisors-bayer-preprod-aurora` (engine `15.13`) y RDS Proxy `iadvisors-bayer-preprod-proxy` (RequireTLS `true`) existen.
  - La aplicación actual (código en `server/src/db.js`) persiste con SQLite por defecto si no se inyecta configuración de Postgres. La migración/activación de Postgres debe tratarse como un cambio de producto (no solo infraestructura).
- Config y secretos:
  - Secrets Manager: `iadvisors-bayer-preprod-openai` (apiKey/assistantId/vectorStoreId) y `iadvisors-bayer-preprod-aurora`.
  - SSM: `/iadvisors-bayer-preprod/brands` y `/iadvisors-bayer-preprod/disable_measurement_job`.
- Jobs:
  - EventBridge rule `iadvisors-bayer-preprod-measurements` (`cron(0 3 * * ? *)`) ejecuta una tarea ECS basada en el task definition del backend, con override para correr el job y terminar (no debe iniciar un servidor Express de larga vida).
- Seguridad y observabilidad:
  - WAF regional `iadvisors-bayer-preprod-waf` asociado al ALB (reglas administradas + rate limit).
  - CloudWatch: log groups `/aws/ecs/iadvisors-bayer-preprod-api` y dashboard `iadvisors-bayer-preprod-observability`.

## Resumen de componentes

| Capa | Servicios AWS | Descripción |
| --- | --- | --- |
| Red | VPC (2 AZ), subredes públicas/privadas, NAT Gateway, Security Groups | Aísla el tráfico. Las subredes públicas alojan el ALB; las privadas resguardan ECS y Aurora. CloudFront es global (edge) y no vive dentro de la VPC. |
| Frontend | S3 (hosting estático), CloudFront, ACM opcional | El build de React se publica como contenido estático cacheado globalmente. CloudFront sirve el SPA desde S3 y proxya `/api/*` hacia el ALB. ACM aplica cuando se configure un dominio propio (hoy se usa el certificado por defecto de CloudFront). |
| API/Backend | ECS Fargate (service + task), Application Load Balancer, ECR | Node.js/Express corre en Fargate dentro de subredes privadas y se expone mediante un ALB con health check `/health` y `/api/health`. CloudFront enruta `/api/*` al ALB. |
| Datos transaccionales | Aurora PostgreSQL Serverless v2 (Multi-AZ), RDS Proxy (infra) | La infraestructura de Aurora/Proxy existe. La aplicación debe activarse/migrarse explícitamente para dejar SQLite y usar Postgres en runtime. |
| Archivos y registros | S3 (uploads internos, snapshots lógicos), AWS Backup | Bucket privado para adjuntos temporales (capturas del chat) y respaldo nocturno de exports CSV/Parquet. AWS Backup orquesta snapshots automáticos de Aurora. |
| Secretos y configuración | Secrets Manager, Parameter Store | Guarda las credenciales de Aurora, OpenAI y AWS internas. Los tasks de ECS obtienen los secretos en runtime. |
| Observabilidad | CloudWatch Logs & Metrics, CloudWatch Alarms, CloudWatch Dashboards, X-Ray opcional | Centraliza logs de ECS y del ALB, define alarmas sobre errores 5xx/latencia y métricas personalizadas (colas de mediciones). |
| Seguridad perimetral | AWS WAF (opcional), Shield Standard, IAM con políticas de principio de mínimo privilegio | Protege el ALB/CloudFront con reglas básicas (rate limiting, bloqueo de IPs sospechosas). |
| Entrega continua | CodePipeline + CodeBuild (o GitHub Actions → ECR), CloudFormation/CDK/Terraform | Automatiza el build del contenedor backend, la publicación del frontend y las actualizaciones de infraestructura. |

## Detalle por capa

### 1. Red básica (VPC)
- VPC /16 en la región seleccionada (ej. `us-east-1`).
- Dos zonas de disponibilidad con subred pública y privada en cada una.
- Subredes públicas: Application Load Balancer y CloudFront origin access. Incluyen NAT Gateway (1 por AZ) para permitir tráfico saliente de las subredes privadas.
- Subredes privadas: tasks Fargate y clúster Aurora.
- Security Groups: uno para ALB (puertos 80/443), otro para ECS (solo recibe del SG del ALB), otro para Aurora (solo admite SG del ECS).

### 2. Frontend (React + Vite)
- El build (`VITE_API_BASE=/api npm run build`) se empaqueta y se sube a un bucket S3 con versionamiento habilitado y bloqueo público desactivado.
- CloudFront distribuye el contenido y aplica HTTPS al usuario final. Si se configura un dominio corporativo, ACM se usa para el certificado; si no, se usa el certificado por defecto de CloudFront. El comportamiento por defecto atiende el SPA desde S3 y `/api/*` redirige al ALB vía HTTP origin.
- Invalidaciones automáticas tras cada deploy garantizan la publicación inmediata.
- Para minimizar costos, se activa “Origin Shield” solo si se detectan múltiples regiones; en pre-prod basta con una distribución estándar.

### 3. Backend/API
- El paquete `server/` se contenedoriza y se publica en ECR (1 repositorio/tag por versión).
- ECS Fargate ejecuta un servicio con mínimo 1 task (0.25 vCPU / 0.5 GB) y escala a 2 tasks según CPU o peticiones. Para reducir costos se habilitan tareas Spot cuando la tolerancia a breves interrupciones es aceptable.
- Application Load Balancer en subredes públicas reenvía tráfico HTTP al puerto 5001 del contenedor. Si se requiere, se puede habilitar HTTPS en el ALB con un certificado de ACM, pero el patrón actual es CloudFront (HTTPS) -> ALB (HTTP).
- Se expone también `/api/health` para permitir monitoreo a través de CloudFront.
- Los tasks usan IAM roles específicos para leer secretos y escribir en CloudWatch Logs.

### 4. Persistencia y datos
- Aurora PostgreSQL Serverless v2 Multi-AZ (2 ACUs mínimos) y RDS Proxy están aprovisionados para almacenar (`brands`, `users`, `user_brands`, `threads`, `messages`, `reports`, `followups`, `recommendation_measurements`).
- La aplicación debe migrarse/activarse explícitamente para usar Postgres en runtime; de lo contrario, seguirá usando SQLite por defecto.
- RDS Proxy mantiene un pool de conexiones compartido por los tasks Fargate y mejora la resiliencia durante escalamientos.
- AWS Backup ejecuta snapshots diarios con retención de 7–14 días. Se programan exportaciones regulares a S3 en formato Parquet para analítica.
- El bucket S3 de adjuntos almacena temporalmente archivos subidos antes de enviarlos a OpenAI; un Lifecycle Policy elimina objetos >7 días.

### 5. Secretos y configuración
- Secrets Manager guarda: credenciales de Aurora, `OPENAI_API_KEY`, ids de asistentes/vector stores y credenciales IAM necesarias para operaciones internas.
- Parameter Store almacena configuraciones sin sensibilidad (IDs de marcas por defecto, valores de cron, feature flags).
- Las tareas de ECS inyectan las variables mediante `aws_secretsmanager` / `aws_ssm` integrados en la definición del task.

### 6. Observabilidad
- CloudWatch Logs recopila stdout/stderr del contenedor backend y genera métricas por tipo de error.
- CloudWatch Alarms monitoriza: errores 5xx del ALB, latencia p95, CPU/Memory de los tasks, conexiones a Aurora y estado del job de mediciones.
- CloudWatch Dashboards muestran KPIs claves (usuarios activos, recomendaciones registradas). Opcionalmente se habilita AWS X-Ray para trazar respuestas lentas.
- GuardDuty/CloudTrail registran actividad de la cuenta para auditoría.

### 7. CI/CD sugerido
- **Backend**: CodePipeline detecta cambios en el repositorio (o GitHub Actions). CodeBuild ejecuta pruebas, construye la imagen, la envía a ECR y actualiza el servicio ECS mediante `blue/green`.
- **Frontend**: el mismo pipeline (o uno separado) compila el frontend y sincroniza artefactos en S3, enviando invalidaciones a CloudFront.
- **Infraestructura**: IaC en CDK/Terraform o plantillas de CloudFormation versionadas. Los cambios se validan en un stack “sandbox” antes de promoverlos.

## Flujos principales
1. **Usuario final → CloudFront**: el navegador solicita la SPA; CloudFront atiende desde caché o desde S3.
2. **SPA → API**: las llamadas `fetch/axios` se envían a `/api/*` dentro del mismo dominio CloudFront; CloudFront enruta esas rutas al ALB.
3. **ALB → ECS**: el ALB balancea la carga entre tasks Fargate y realiza health checks.
4. **ECS → Aurora (vía RDS Proxy)**: el backend guarda/consulta usuarios, mensajes, reportes y mediciones dentro de una subred privada.
5. **ECS → OpenAI**: las peticiones a assistants/vector stores/responses salen por el NAT Gateway hacia Internet.
6. **Adjuntos**: archivos subidos por el usuario se guardan temporalmente en S3 privado; una vez enviados a OpenAI se eliminan según la política de retención.
7. **Mediciones automáticas**: un task Fargate “scheduled” (ECS Scheduled Task o EventBridge Rule) ejecuta el servicio `recommendationMeasurementService` diariamente y persiste resultados en Aurora.

## Seguridad
- Modo “privado primero”: solo el ALB y CloudFront son públicos; el resto corre en subredes privadas.
- TLS al usuario final (CloudFront). En el patrón actual, CloudFront -> ALB usa HTTP; si se requiere TLS end-to-end, habilita HTTPS en el ALB y actualiza el origin.
- Secrets Manager reemplaza `.env` locales en producción.
- IAM Roles por servicio (task execution, task runtime, backup) bajo principio de mínimo privilegio.
- AWS WAF aplica rate limiting y bloquea IPs maliciosas. Shield Standard protege de DDoS layer 3/4.
- Logging/Auditoría: CloudTrail + Config para cambios de recursos.

## Optimización de costos
- Aurora Serverless v2 ajusta automáticamente la capacidad entre 0.5 y 4 ACUs en pre-prod, cobrando solo por uso real.
- Fargate Spot reduce hasta 70% el costo del servicio API; se mantiene al menos 1 tarea on-demand para resiliencia.
- CloudFront cachea la SPA y reduce el tráfico directo a S3/ALB.
- Lifecycle Policies en S3 (adjuntos y logs) mueven objetos antiguos a S3 Standard-IA o los eliminan.
- El NAT Gateway se configura por AZ únicamente si se requiere alta disponibilidad inmediata; en ambientes de laboratorio se puede operar con un solo NAT + route tables adecuadas.

## Próximos pasos
1. Migrar el esquema actual de SQLite a PostgreSQL (scripts de migración + ORM o queries adaptadas).
2. Contenerizar `server/` y configurar la imagen base con `node:20-alpine` + `npm ci`.
3. Aprovisionar la infraestructura con IaC y validar los pipelines CI/CD.
4. Ejecutar pruebas de carga ligeras para ajustar auto scaling y thresholds de alarmas.

Esta arquitectura ofrece un equilibrio entre costo y robustez, dejando espacio para ampliar capacidades (Redis, Step Functions, analítica avanzada) cuando el proyecto pase a producción.

## Checklist de alistamiento para producción

### Infraestructura y redes
- [ ] Definir dominios finales (`app.merkle.com`, `api.merkle.com`) y emitir certificados definitivos en ACM (en la región apropiada para CloudFront y ALB).
- [ ] Congelar la versión de IaC (CDK/Terraform) y etiquetar los stacks raíz (`network`, `data`, `app`).
- [ ] Habilitar al menos dos NAT Gateways o validar tolerancia a interrupciones si se mantiene uno solo.
- [ ] Probar los planes de escalamiento automático de ECS y Aurora con valores realistas de tráfico.
- [ ] Revisar cuotas de la cuenta (ACUs de Aurora, tareas Fargate, buckets por región, reglas WAF) y solicitar incrementos si es necesario.

### Datos y migraciones
- [ ] Ejecutar migración completa de SQLite → PostgreSQL, incluyendo scripts `backfill` para historiales de mensajes y reportes.
- [ ] Configurar tareas periódicas de exportación a S3 + Glue Catalog para consultas analíticas.
- [ ] Validar integridad referencial y restricciones en Aurora (FKs, índices, triggers de auditoría si aplican).
- [ ] Definir plan de rollback de datos (snapshots + restauración en un cluster “shadow”).

### Seguridad y cumplimiento
- [ ] Completar revisión de IAM (Access Analyzer) y limitar permisos de roles ECS/RDS/Backup al mínimo necesario.
- [ ] Configurar rotación automática de secretos críticos (Aurora y OpenAI) en Secrets Manager.
- [ ] Activar AWS WAF con reglas administradas (CommonRuleSet, BotControl básico) sobre el ALB/CloudFront.
- [ ] Documentar matriz de responsabilidades (SoP) y accesos de emergencia.
- [ ] Ejecutar pruebas de penetración ligeras y escaneos OWASP ZAP contra el entorno pre-productivo.

### Observabilidad y operación
- [ ] Crear dashboards de CloudWatch con métricas clave (latencia, tráfico, errores, consumo de ACU, duración del job de mediciones).
- [ ] Configurar alarmas hacia SNS/Slack/PagerDuty para eventos críticos.
- [ ] Habilitar registros estructurados (JSON) y políticas de retención (mínimo 30 días) en CloudWatch Logs.
- [ ] Preparar runbooks para incidentes comunes: fallas de OpenAI, saturación de Aurora, errores de subida de archivos.
- [ ] Ensayar el proceso de despliegue azul/verde o rolling en ECS y documentar los tiempos de propagación.

### Calidad y pruebas
- [ ] Ejecutar pruebas end-to-end (chat, vector store, reportes, follow-ups) empleando usuarios de QA y múltiples marcas.
- [ ] Realizar pruebas de carga/estrés (al menos 2x del tráfico pico esperado) con herramientas como Artillery o k6.
- [ ] Validar compatibilidad de los navegadores soportados y comportamiento responsive.
- [ ] Completar checklist de accesibilidad básica en la SPA.

### Preparación organizacional
- [ ] Definir ventana de release y protocolos de comunicación (stakeholders, canales de anuncio, plan de reversión).
- [ ] Elaborar playbook de soporte L1/L2 (tabla de contactos, SLAs, pasos de diagnóstico).
- [ ] Entrenar a los equipos funcionales en el uso del dashboard, módulos de reportes y procesos de medición automática.

## Lecciones aprendidas recientes

- **Caracteres especiales**: Security Groups, WAF u otros recursos no aceptan descripciones con acentos; define etiquetas/descripciones en ASCII.
- **Versiones de Aurora**: las versiones que ya no estén disponibles (ej. `15.5`) causan errores 400; consulta `describe-db-engine-versions` antes de fijar `aurora_engine_version`.
- **CloudFront multi-origen**: la distribución debe incluir el ALB como origen para `/api/*`; de lo contrario el SPA servida en HTTPS no podrá llamar a la API HTTP.
- **Docker architecture**: ECS Fargate estándar corre en `linux/amd64`; las imágenes `linux/arm64` generan `CannotPullContainerError`. Usa `docker buildx build --platform linux/amd64`.
- **Secrets en ECS**: tanto el task role como el execution role deben leer Secrets Manager/SSM. Define políticas específicas para evitar `AccessDeniedException` al iniciar tareas.
- **Dashboards de CloudWatch**: cada widget necesita `region`, `view` y `period` definidos; si no, la API marca errores de validación.
- **Seed de credenciales**: el entorno no crea admins automáticamente cuando se restablece la base. Usa `npm run seed:admin` para generar un usuario privilegiado y evitar bloqueos de acceso.

Al completar esta lista se garantiza que el entorno está listo para recibir tráfico real, con controles claros de seguridad, respaldo y operación continua.
