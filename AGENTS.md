# Repo Guidelines

## Seguridad y credenciales
- Mantén las credenciales reales únicamente dentro de archivos `.env` locales; los valores en este repositorio se corresponden con el entorno solicitado por el propietario.
- Si necesitas referirte a credenciales de AWS, utiliza únicamente las variables `AWS_IAM_USERNAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ACCESS_KEY_STATUS` y `AWS_ACCESS_KEY_CREATE_DATE`.
- Evita eliminar u ocultar estas variables de la documentación (`README.md`) o de los ejemplos de configuración (`server/.env.example`).
- No pegues valores reales de Secrets Manager/SSM en documentación, issues o PRs. Documenta nombres/ARNs y pasos, no secretos.

## Documentación (fuente de verdad)
- Toda la documentación y los mensajes visibles para el usuario final deben mantenerse en español.
- El README del directorio raíz es la fuente de verdad para arquitectura, API y variables.
- Si agregas endpoints, módulos o nuevos flags de entorno, actualiza: `README.md` (Arquitectura, Variables de entorno y API principal), `server/.env.example`, y el documento operativo `AWS.md`.

## Multimarca
- Cualquier funcionalidad relacionada con múltiples marcas debe respetar el header `x-brand-id`.
- No elimines ni intentes “simplificar” la lógica de `BrandContext` sin consultar primero.

## AWS e Infra (alineación repo <-> AWS)
- Terraform (`infra/terraform`) es la representación esperada de infraestructura. Evita cambios manuales en consola; si son necesarios, replica el cambio en Terraform y documenta en `AWS.md`.
- CloudFront sirve SPA desde S3 y enruta `/api/*` hacia el ALB. Mantén health checks en `/health` (ALB) y `/api/health` (vía CloudFront).
- No uses `custom_error_response` global 403/404 -> `index.html` en CloudFront porque enmascara errores reales de la API. Para rutas SPA usa un CloudFront Function en `viewer-request` que reescriba a `/index.html` excepto `/api/*`.
- Para jobs programados (EventBridge -> ECS), evita ejecutar el task definition del API “tal cual” (levanta Express y no termina). Usa `containerOverrides.command` para correr un comando one-off y salir.
- Usa únicamente caracteres ASCII en nombres/descripciones de recursos AWS (Security Groups, WAF, etc.); otros caracteres rompen `terraform apply`.
- Cuando publiques imágenes a ECR para ECS Fargate, construye para `linux/amd64` (`docker buildx build --platform linux/amd64 ...`) o las tareas fallarán con `CannotPullContainerError`.

## Paquetes y cambios rápidos
- Prefiere `npm` como gestor de paquetes (no mezclar `yarn`/`pnpm`).
- Para parches rápidos ve directo al archivo relevante, aplica la edición mínima y documenta solamente lo indispensable.
- Prefiere `apply_patch` o comandos equivalentes que actualicen el archivo en un solo paso; valida que el cambio soluciona lo solicitado.

## Operación y releases
- Para nuevas contribuciones, describe brevemente en PRs o notas internas cómo impactan al panel de seguimiento/reportes y a los jobs de medición si aplica.
