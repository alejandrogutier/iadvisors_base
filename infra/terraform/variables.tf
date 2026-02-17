variable "project_name" {
  type        = string
  description = "Nombre base para etiquetar recursos"
  default     = "iadvisors-bayer"
}

variable "environment" {
  type        = string
  description = "Ambiente desplegado (preprod, prod, etc.)"
  default     = "preprod"
}

variable "aws_region" {
  type        = string
  description = "Región principal de AWS"
  default     = "us-east-1"
}

variable "vpc_cidr" {
  type        = string
  description = "Bloque CIDR para la VPC principal"
  default     = "10.40.0.0/16"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDRs para las subredes públicas"
  default     = ["10.40.0.0/20", "10.40.16.0/20"]
}

variable "private_app_subnet_cidrs" {
  type        = list(string)
  description = "CIDRs para subredes privadas (ECS)"
  default     = ["10.40.32.0/20", "10.40.48.0/20"]
}

variable "private_data_subnet_cidrs" {
  type        = list(string)
  description = "CIDRs para subredes privadas (Aurora)"
  default     = ["10.40.64.0/20", "10.40.80.0/20"]
}

variable "alb_certificate_arn" {
  type        = string
  description = "ARN del certificado ACM para el ALB (opcional). Si se deja vacío se creará solo listener HTTP."
  default     = ""
}

variable "openai_api_key" {
  type        = string
  description = "API key de OpenAI para Secrets Manager"
  sensitive   = true
}

variable "openai_assistant_id" {
  type        = string
  description = "Assistant ID predeterminado"
}

variable "openai_vector_store_id" {
  type        = string
  description = "Vector Store ID predeterminado"
}

variable "brand_catalog" {
  type = map(object({
    id                = string
    slug              = string
    default_assistant = string
    vector_store      = string
  }))
  description = "Catálogo inicial de marcas para parametrizar el backend"
  default     = {}
}

variable "measurement_schedule_expression" {
  type        = string
  description = "Expresión de EventBridge para el job de mediciones"
  default     = "cron(0 3 * * ? *)"
}

variable "aurora_min_capacity" {
  type        = number
  description = "Capacidad mínima (ACU) para Aurora Serverless v2"
  default     = 2
}

variable "aurora_max_capacity" {
  type        = number
  description = "Capacidad máxima (ACU) para Aurora Serverless v2"
  default     = 8
}

variable "aurora_engine_version" {
  type        = string
  description = "Versión del engine de Aurora PostgreSQL"
  default     = "15.13"
}

variable "allowed_ingress_cidrs" {
  type        = list(string)
  description = "Bloques CIDR permitidos para el ALB"
  default     = ["0.0.0.0/0"]
}

variable "tags" {
  type        = map(string)
  description = "Etiquetas adicionales opcionales"
  default     = {}
}
