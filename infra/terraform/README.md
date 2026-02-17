# Infraestructura como código – Terraform

Este directorio contiene una configuración de Terraform lista para desplegar el entorno pre-productivo descrito en `ARCHITECTURE.md`. Los recursos creados incluyen VPC multi-AZ, subredes públicas/privadas, NAT Gateways, S3 + CloudFront para el frontend, ECS Fargate detrás de un ALB, Aurora PostgreSQL Serverless v2 con RDS Proxy, Secrets Manager/Parameter Store, CloudWatch (logs, alarms y dashboard), WAF, EventBridge para el job de mediciones y buckets auxiliares para adjuntos y backups.

## Requisitos previos

- Terraform >= 1.6
- AWS CLI configurado con un perfil con permisos para crear los recursos mencionados
- Variables sensibles (OpenAI y catálogos de marcas) listas para pasarse mediante `terraform.tfvars` o variables de entorno

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
| `openai_api_key`, `openai_assistant_id`, `openai_vector_store_id` | Credenciales que se almacenan en Secrets Manager |
| `brand_catalog` | Mapa con las marcas iniciales (IDs, slugs, asistentes y vector stores) |
| `measurement_schedule_expression` | Cron de EventBridge para el job de mediciones |
| `aurora_min_capacity`, `aurora_max_capacity` | Límites de Aurora Serverless v2 |
| `aurora_engine_version` | Versión de Aurora PostgreSQL (por defecto `15.13`) |

Define los valores sensibles en un archivo `terraform.tfvars` que **no** debe versionarse. Ejemplo:

```hcl
project_name  = "iadvisors-bayer"
environment   = "preprod"
openai_api_key = "sk-..."
openai_assistant_id = "asst_..."
openai_vector_store_id = "vs_..."
brand_catalog = {
  gynocanesten = {
    id                = "gynocanesten"
    slug              = "gynocanesten"
    default_assistant = "asst_..."
    vector_store      = "vs_..."
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

Tras la aplicación se mostrará el dominio asignado por CloudFront (`cloudfront_domain`), el DNS del ALB (`alb_dns_name`), los buckets y el repositorio ECR para publicar la imagen del backend.

## Tareas posteriores

1. Construir la imagen Docker del backend y publicarla en el repositorio ECR expuesto en los outputs.
2. Ejecutar el workflow de GitHub Actions (`.github/workflows/deploy.yml`) para orquestar los builds y despliegues.
3. Migrar los datos de SQLite a Aurora usando `npm run migrate:sqlite-to-pg` (ver `server/scripts/migrate_sqlite_to_pg.js`).
4. Verificar las alarmas y dashboards en CloudWatch, así como la asociación de WAF y la regla de EventBridge.

Consulta el README principal para más detalles de operación, monitoreo y checklist previo a producción.
