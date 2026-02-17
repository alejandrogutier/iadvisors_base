# AWS (preprod) – IAdvisors Bayer

Documento operativo para entender qué está desplegado en AWS, cómo funciona el routing, cómo desplegar, cómo validar salud y cómo conectarse a los servicios de datos.

Auditado: **2026-02-17**  
Cuenta AWS: `741448945431`  
Región principal: `us-east-1`

## Principios
- Terraform (`infra/terraform`) representa la infraestructura esperada. Evita cambios manuales; si se hacen por emergencia, replica en Terraform y documenta aquí.
- No pegues secretos en documentación. Usa nombres/ARNs y pasos, nunca valores reales.
- CloudFront no debe enmascarar errores de API (403/404) devolviendo `index.html`. El SPA se resuelve por rewrite en `viewer-request` y `/api/*` se deja pasar al ALB.

## Puntos de entrada
- App (SPA): `https://d1jd44v3p51cpx.cloudfront.net/`
- Ruta principal de chat: `https://d1jd44v3p51cpx.cloudfront.net/chat`
- API a través de CloudFront: `https://d1jd44v3p51cpx.cloudfront.net/api/*`
- Health (vía CloudFront): `https://d1jd44v3p51cpx.cloudfront.net/api/health`
- Health (directo ALB): `http://iadvisors-bayer-preprod-alb-1320845857.us-east-1.elb.amazonaws.com/health`

## Servicios usados (estado actual)

### CloudFront
- Distribution ID: `E2ZO7JQ06J9PLY`
- Domain: `d1jd44v3p51cpx.cloudfront.net`
- Orígenes:
  - `frontend-s3`: `iadvisors-bayer-preprod-frontend20251202172221317100000001` (S3 privado con OAC `E1ALTMPLJW2E3V`)
  - `backend-alb`: `iadvisors-bayer-preprod-alb-1320845857.us-east-1.elb.amazonaws.com` (origin `http-only`)
- Routing:
  - Default behavior: S3 (SPA)
  - Ordered behavior: `/api/*` -> ALB
- SPA rewrite:
  - CloudFront Function: `iadvisors-bayer-preprod-spa-rewrite` (evento `viewer-request`)
  - Regla: reescribe rutas sin extensión a `/index.html`, excepto `/api/*`

### S3
- Bucket frontend (SPA): `iadvisors-bayer-preprod-frontend20251202172221317100000001`
- Bucket uploads (adjuntos temporales): `iadvisors-bayer-preprod-uploads20251202172222130200000003`
- Bucket KB (documentos RAG): `<terraform output kb_bucket>`
  - Lifecycle: expira objetos a 7 días
  - Encripción: AES256
  - Public access block: habilitado (privado)

### Amplify
- App ID: `d3c70eu0nxorn3`
- App name: `iadvisors_base`
- Dominio default: `d3c70eu0nxorn3.amplifyapp.com`
- Repositorio conectado: `https://github.com/alejandrogutier/iadvisors_base`

### Cognito
- User Pool ID: `us-east-1_h2GrYu37Z`
- User Pool name: `iadvisors-bayer-preprod-users`
- App Client ID: `kkj80nol9b8vhoic370921rdl` (sin secret, `USER_PASSWORD_AUTH`)
- Grupos:
  - `admin` (precedence `1`)
  - `analyst` (precedence `2`)
- Variables de runtime requeridas en API:
  - `COGNITO_USER_POOL_ID`
  - `COGNITO_CLIENT_ID`
  - `COGNITO_REGION`

### ALB (Application Load Balancer)
- Nombre: `iadvisors-bayer-preprod-alb`
- DNS: `iadvisors-bayer-preprod-alb-1320845857.us-east-1.elb.amazonaws.com`
- Listener: HTTP `:80`
- Target group: `iadvisors-bayer-preprod-tg` (port `5001`, health check path `/health`)

### ECS Fargate
- Cluster: `iadvisors-bayer-preprod-cluster`
- Service: `iadvisors-bayer-preprod-api` (desired normalmente `1`)
- Task definition: `iadvisors-bayer-preprod-api:3`
  - Container: `api`
  - Image: `741448945431.dkr.ecr.us-east-1.amazonaws.com/iadvisors-bayer-preprod-api:latest`
  - Puerto: `5001`
  - Secrets/params en runtime:
    - Secrets Manager: `iadvisors-bayer-preprod-aurora` (`username`, `password`, `host`, `dbname`, `port`)
    - SSM: `/iadvisors-bayer-preprod/brands` y `/iadvisors-bayer-preprod/disable_measurement_job`
  - Variables de entorno adicionales:
    - `AI_PROVIDER=bedrock`
    - `BEDROCK_REGION=us-east-1`
    - `BEDROCK_MODEL_ID_DEFAULT=<model-id>`
    - `BEDROCK_MEASUREMENT_MODEL=<model-id>`
    - `KB_BUCKET=<bucket-kb>`
    - `COGNITO_USER_POOL_ID=us-east-1_h2GrYu37Z`
    - `COGNITO_CLIENT_ID=kkj80nol9b8vhoic370921rdl`
    - `COGNITO_REGION=us-east-1`
- Auto Scaling:
  - Min `1`, Max `4`
  - Target tracking por CPU (target `60%`)

### ECR
- Repositorio: `iadvisors-bayer-preprod-api`
- Convención: `latest` + opcional tag por SHA (`${GITHUB_SHA}` en GitHub Actions)

### Bedrock + Knowledge Base
- Runtime: Amazon Bedrock (`Converse`, `Retrieve`, `RetrieveAndGenerate`)
- Colección vectorial: OpenSearch Serverless (`VECTORSEARCH`) compartida para KB.
- KB por marca: creada/actualizada por backend usando `BEDROCK_KB_ROLE_ARN` y `BEDROCK_KB_COLLECTION_ARN`.
- Data Source por marca: prefijo S3 `kb/<brand_id>/` en `KB_BUCKET`.
- Rol de servicio KB: `<terraform output bedrock_kb_role_arn>`.

### Aurora PostgreSQL + RDS Proxy (infra lista)
- Aurora cluster: `iadvisors-bayer-preprod-aurora` (engine `aurora-postgresql`, versión `15.13`)
- DB name: `iadvisors`
- RDS Proxy: `iadvisors-bayer-preprod-proxy` (RequireTLS `true`)
- Importante:
  - Aurora/Proxy viven en subredes privadas (sin endpoint público).
  - La aplicación debe migrarse/activarse explícitamente para usar Postgres en runtime; el código actual usa SQLite por defecto si no se inyecta configuración de Postgres.

### Secrets Manager y SSM
- Secrets Manager:
  - `iadvisors-bayer-preprod-aurora`
- SSM Parameter Store:
  - `/iadvisors-bayer-preprod/brands` (catálogo de marcas)
  - `/iadvisors-bayer-preprod/disable_measurement_job` (feature flag del job)

### EventBridge (job de mediciones)
- Rule: `iadvisors-bayer-preprod-measurements`
- Schedule: `cron(0 3 * * ? *)`
- Target: ECS task en `iadvisors-bayer-preprod-cluster` basado en el mismo task definition del backend, pero con **container override** para ejecutar un runner de una sola vez (llama `POST /api/measurements/run` por marca via ALB y termina). Esto evita que el rule levante servidores API “huérfanos” que quedan corriendo indefinidamente.

### WAF
- Web ACL regional: `iadvisors-bayer-preprod-waf`
- Asociado al ALB (no a CloudFront)
- Reglas: `AWSManagedRulesCommonRuleSet` + rate limit (IP)

### CloudWatch
- Log groups:
  - `/aws/ecs/iadvisors-bayer-preprod-api`
  - `/aws/ecs/iadvisors-bayer-preprod-measurements`
- Dashboard: `iadvisors-bayer-preprod-observability`
- Alarmas principales (prefijo): `iadvisors-bayer-preprod-`

## Credenciales y acceso (AWS CLI)

### Uso local (sin exponer secretos)
- Credenciales en `.env` local:
  - `AWS_IAM_USERNAME`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_ACCESS_KEY_STATUS`
  - `AWS_ACCESS_KEY_CREATE_DATE`
  - `AMPLIFY_APP_ID`
  - `COGNITO_USER_POOL_ID`
  - `COGNITO_CLIENT_ID`
  - `COGNITO_REGION`

### Comandos útiles
```bash
# Identidad AWS (verifica que el CLI está autenticando)
set -a; source .env; set +a
aws sts get-caller-identity

# Estado distribución CloudFront
aws cloudfront get-distribution --id E2ZO7JQ06J9PLY --query 'Distribution.Status' --output text

# Estado app Amplify
aws amplify get-app --app-id $AMPLIFY_APP_ID --query 'app.{name:name,defaultDomain:defaultDomain}' --output table

# Estado Cognito
aws cognito-idp describe-user-pool --user-pool-id $COGNITO_USER_POOL_ID --query 'UserPool.{Name:Name,Id:Id,Status:Status}' --output table
aws cognito-idp describe-user-pool-client --user-pool-id $COGNITO_USER_POOL_ID --client-id $COGNITO_CLIENT_ID --query 'UserPoolClient.{ClientName:ClientName,ClientId:ClientId}' --output table

# Validación rápida de routing
curl -I https://d1jd44v3p51cpx.cloudfront.net/api/health
curl -I http://iadvisors-bayer-preprod-alb-1320845857.us-east-1.elb.amazonaws.com/health
```

## Despliegue (resumen)

### Backend (ECR + ECS)
- Construir imagen y publicar en ECR.
- Forzar redeploy del servicio ECS (rolling):
```bash
aws ecs update-service --cluster iadvisors-bayer-preprod-cluster --service iadvisors-bayer-preprod-api --force-new-deployment
aws ecs wait services-stable --cluster iadvisors-bayer-preprod-cluster --services iadvisors-bayer-preprod-api
```

### Frontend (S3 + CloudFront)
```bash
cd client
VITE_API_BASE=/api npm run build
aws s3 sync dist s3://iadvisors-bayer-preprod-frontend20251202172221317100000001 --delete
aws cloudfront create-invalidation --distribution-id E2ZO7JQ06J9PLY --paths "/*"
```

## Troubleshooting

### La API devuelve HTML (SPA) en lugar de JSON
- Síntoma: un 404/400 debería devolver JSON, pero CloudFront devuelve `index.html`.
- Causa típica: `custom_error_response` 403/404 -> `/index.html` configurado globalmente en CloudFront.
- Solución: usar CloudFront Function `viewer-request` para rewrite SPA y dejar que `/api/*` responda sus errores reales.

### Se acumulan tareas ECS corriendo desde el rule de mediciones
- Síntoma: aparecen muchas tareas `RUNNING` con `startedBy=events-rule/...` en el cluster, y el costo sube.
- Causa típica: el target de EventBridge ejecuta el task definition del backend sin override, por lo que inicia el servidor Express y nunca termina.
- Solución: configurar `containerOverrides.command` para ejecutar un runner (una sola vez) y salir. Luego detener las tareas “huérfanas”.

### Job de mediciones falla con errores Bedrock
- Verifica permisos IAM del task role para `bedrock:InvokeModel`.
- Confirma que el `BEDROCK_MEASUREMENT_MODEL` está habilitado en la cuenta/región.
- Revisa logs en `/aws/ecs/iadvisors-bayer-preprod-api` para detalles del request ID.

### Login falla con 401/500 en `/api/users/login`
- Verifica `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` y `COGNITO_REGION` en el task de ECS.
- Confirma permisos IAM del task role para `cognito-idp:InitiateAuth` y `cognito-idp:AdminSetUserPassword`.
- Prueba credenciales directas contra Cognito:
  ```bash
  aws cognito-idp initiate-auth \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id $COGNITO_CLIENT_ID \
    --auth-parameters USERNAME=admin@tu-dominio.com,PASSWORD='PasswordSegura123!'
  ```

### Aurora/RDS Proxy no son accesibles desde tu máquina
- Es esperado: no hay endpoint público.
- Corre scripts de migración desde dentro de la VPC (p.ej. tarea Fargate temporal, bastion, o runner con acceso privado).
