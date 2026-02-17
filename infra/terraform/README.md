# Infraestructura como código – Terraform

Este directorio contiene una configuración de Terraform lista para desplegar el entorno pre-productivo descrito en `ARCHITECTURE.md`. Los recursos creados incluyen VPC multi-AZ, subredes públicas/privadas, NAT Gateways, S3 + CloudFront para el frontend, ECS Fargate detrás de un ALB, Cognito (User Pool + App Client + grupos), Aurora PostgreSQL Serverless v2 con RDS Proxy, Bedrock + OpenSearch Serverless para KB vectorial, Secrets Manager/Parameter Store, CloudWatch (logs, alarms y dashboard), WAF, EventBridge para el job de mediciones y buckets auxiliares.

## Requisitos previos

- Terraform >= 1.6
- AWS CLI configurado con un perfil con permisos para crear los recursos mencionados
- Variables sensibles (Bedrock y catálogos de marcas) listas para pasarse mediante `terraform.tfvars` o variables de entorno

## Estructura

- `versions.tf`: versiones mínimas de Terraform y proveedores
- `variables.tf`: parámetros personalizables (región, CIDRs, certificados, catálogo de marcas, escalamiento, etc.)
- `main.tf`: definición de la topología completa

## Variables principales

| Variable | Descripción |
| --- | --- |
| `project_name` | Prefijo para nombrar y etiquetar recursos |
| `environment` | Ambiente desplegado (`preprod`, `prod`, etc.) |
| `aws_region` | Región principal (por defecto `us-east-1`) |
| `alb_certificate_arn` | Certificado ACM opcional para habilitar HTTPS en el ALB |
| `bedrock_model_id_default`, `bedrock_measurement_model`, `bedrock_embedding_model_arn` | Configuración base de modelos Bedrock |
| `bedrock_kb_vector_index_name` | Nombre del índice vectorial en OpenSearch Serverless |
| `brand_catalog` | Mapa con marcas iniciales (IDs, slugs, modelo por defecto y KB opcional) |
| `measurement_schedule_expression` | Cron de EventBridge para el job de mediciones |
| `aurora_min_capacity`, `aurora_max_capacity` | Límites de Aurora Serverless v2 |
| `aurora_engine_version` | Versión de Aurora PostgreSQL (por defecto `15.13`) |
| `tags` | Mapa de etiquetas adicionales para recursos (incluye `iadvisors=true` por defecto) |

Define los valores sensibles en un archivo `terraform.tfvars` que **no** debe versionarse. Ejemplo:

```hcl
project_name  = "iadvisors-bayer"
environment   = "preprod"
bedrock_model_id_default = "anthropic.claude-3-5-haiku-20241022-v1:0"
bedrock_measurement_model = "anthropic.claude-3-5-haiku-20241022-v1:0"
bedrock_embedding_model_arn = "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"
brand_catalog = {
  gynocanesten = {
    id            = "gynocanesten"
    slug          = "gynocanesten"
    default_model = "anthropic.claude-3-5-haiku-20241022-v1:0"
  }
}
```

## Comandos recomendados

```bash
cd infra/terraform
terraform init
terraform plan -out tfplan
terraform apply tfplan
```

Tras la aplicación se mostrará el dominio asignado por CloudFront (`cloudfront_domain`), el DNS del ALB (`alb_dns_name`), buckets (`frontend_bucket`, `uploads_bucket`, `kb_bucket`), colección vectorial (`kb_collection_arn`), repositorio ECR y IDs de Cognito (`cognito_user_pool_id`, `cognito_user_pool_client_id`).

## Tareas posteriores

1. Construir la imagen Docker del backend y publicarla en el repositorio ECR expuesto en los outputs.
2. Ejecutar el workflow de GitHub Actions (`.github/workflows/deploy.yml`) para orquestar los builds y despliegues.
3. Migrar los datos de SQLite a Aurora usando `npm run migrate:sqlite-to-pg` (ver `server/scripts/migrate_sqlite_to_pg.js`).
4. Verificar las alarmas y dashboards en CloudWatch, así como la asociación de WAF y la regla de EventBridge.

Consulta el README principal para más detalles de operación, monitoreo y checklist previo a producción.
