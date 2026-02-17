###############################
# Redes y subredes
###############################

data "aws_availability_zones" "selected" {
  state = "available"
}

locals {
  azs                  = slice(data.aws_availability_zones.selected.names, 0, 2)
  name_prefix          = "${var.project_name}-${var.environment}"
  merged_tags          = merge(var.tags, { Project = var.project_name, Environment = var.environment })
  measurement_job_env  = [{ name = "DISABLE_MEASUREMENT_JOB", value = "false" }]
  public_subnets       = { for idx, az in local.azs : tostring(idx) => { az = az, cidr = var.public_subnet_cidrs[idx] } }
  private_app_subnets  = { for idx, az in local.azs : tostring(idx) => { az = az, cidr = var.private_app_subnet_cidrs[idx] } }
  private_data_subnets = { for idx, az in local.azs : tostring(idx) => { az = az, cidr = var.private_data_subnet_cidrs[idx] } }
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(local.merged_tags, { Name = "${local.name_prefix}-vpc" })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.merged_tags, { Name = "${local.name_prefix}-igw" })
}

resource "aws_subnet" "public" {
  for_each                = local.public_subnets
  vpc_id                  = aws_vpc.main.id
  availability_zone       = each.value.az
  cidr_block              = each.value.cidr
  map_public_ip_on_launch = true

  tags = merge(local.merged_tags, {
    Name = "${local.name_prefix}-public-${each.key}"
    Tier = "public"
  })
}

resource "aws_subnet" "private_app" {
  for_each          = local.private_app_subnets
  vpc_id            = aws_vpc.main.id
  availability_zone = each.value.az
  cidr_block        = each.value.cidr

  tags = merge(local.merged_tags, {
    Name = "${local.name_prefix}-private-app-${each.key}"
    Tier = "private-app"
  })
}

resource "aws_subnet" "private_data" {
  for_each          = local.private_data_subnets
  vpc_id            = aws_vpc.main.id
  availability_zone = each.value.az
  cidr_block        = each.value.cidr

  tags = merge(local.merged_tags, {
    Name = "${local.name_prefix}-private-data-${each.key}"
    Tier = "private-data"
  })
}

resource "aws_eip" "nat" {
  for_each = aws_subnet.public

  domain = "vpc"

  tags = merge(local.merged_tags, { Name = "${local.name_prefix}-nat-${each.key}" })
}

resource "aws_nat_gateway" "this" {
  for_each      = aws_subnet.public
  allocation_id = aws_eip.nat[each.key].id
  subnet_id     = aws_subnet.public[each.key].id

  tags = merge(local.merged_tags, { Name = "${local.name_prefix}-nat-${each.key}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.merged_tags, { Name = "${local.name_prefix}-public-rt" })
}

resource "aws_route_table_association" "public" {
  for_each       = aws_subnet.public
  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private_app" {
  for_each = aws_subnet.private_app
  vpc_id   = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this[each.key].id
  }

  tags = merge(local.merged_tags, { Name = "${local.name_prefix}-private-app-rt-${each.key}" })
}

resource "aws_route_table_association" "private_app" {
  for_each       = aws_subnet.private_app
  subnet_id      = each.value.id
  route_table_id = aws_route_table.private_app[each.key].id
}

resource "aws_route_table" "private_data" {
  for_each = aws_subnet.private_data
  vpc_id   = aws_vpc.main.id

  # Las subredes de datos no necesitan salida a internet directa

  tags = merge(local.merged_tags, { Name = "${local.name_prefix}-private-data-rt-${each.key}" })
}

resource "aws_route_table_association" "private_data" {
  for_each       = aws_subnet.private_data
  subnet_id      = each.value.id
  route_table_id = aws_route_table.private_data[each.key].id
}

###############################
# Buckets S3 y CloudFront
###############################

resource "aws_s3_bucket" "frontend" {
  bucket_prefix = "${local.name_prefix}-frontend"
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket" "uploads" {
  bucket_prefix = "${local.name_prefix}-uploads"
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "expire-temporary-uploads"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = 7
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.name_prefix}-oac"
  description                       = "Acceso privado al bucket del frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal",
        Effect    = "Allow",
        Principal = { Service = "cloudfront.amazonaws.com" },
        Action    = "s3:GetObject",
        Resource  = "${aws_s3_bucket.frontend.arn}/*",
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}

resource "aws_cloudfront_function" "spa_rewrite" {
  provider = aws.cloudfront
  name     = "${local.name_prefix}-spa-rewrite"
  runtime  = "cloudfront-js-1.0"
  comment  = "Rewrite SPA routes to index.html without touching /api"

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri || "/";

      if (uri === "/api" || uri.indexOf("/api/") === 0) {
        return request;
      }

      if (uri === "/" || uri.indexOf(".") !== -1) {
        return request;
      }

      request.uri = "/index.html";
      return request;
    }
  EOT
}

resource "aws_cloudfront_distribution" "frontend" {
  provider            = aws.cloudfront
  enabled             = true
  is_ipv6_enabled     = false
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "frontend-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  origin {
    domain_name = aws_lb.app.dns_name
    origin_id   = "backend-alb"

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "http-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60
      origin_keepalive_timeout = 5
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "frontend-s3"

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0

    forwarded_values {
      query_string = true

      cookies {
        forward = "none"
      }
    }

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_rewrite.arn
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "backend-alb"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0

    forwarded_values {
      query_string = true

      cookies {
        forward = "all"
      }

      headers = ["*"]
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  price_class = "PriceClass_100"

  tags = merge(local.merged_tags, { Component = "frontend" })
}

###############################
# Seguridad y secretos
###############################

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Allow public HTTP and HTTPS"
  vpc_id      = aws_vpc.main.id

  dynamic "ingress" {
    for_each = var.allowed_ingress_cidrs

    content {
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  dynamic "ingress" {
    for_each = var.allowed_ingress_cidrs

    content {
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-ecs-sg"
  description = "Allow traffic only from ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5001
    to_port         = 5001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "aurora" {
  name        = "${local.name_prefix}-aurora-sg"
  description = "Allow connections from ECS/RDS Proxy"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "random_password" "aurora" {
  length  = 20
  special = true
}

resource "aws_secretsmanager_secret" "aurora" {
  name = "${local.name_prefix}-aurora"
}

resource "aws_secretsmanager_secret_version" "aurora" {
  secret_id = aws_secretsmanager_secret.aurora.id

  secret_string = jsonencode({
    username = "iadvisors_admin"
    password = random_password.aurora.result
    host     = aws_rds_cluster.aurora.endpoint
    reader   = aws_rds_cluster.aurora.reader_endpoint
    dbname   = aws_rds_cluster.aurora.database_name
    port     = 5432
  })
}

resource "aws_secretsmanager_secret" "openai" {
  name = "${local.name_prefix}-openai"
}

resource "aws_secretsmanager_secret_version" "openai" {
  secret_id = aws_secretsmanager_secret.openai.id

  secret_string = jsonencode({
    apiKey        = var.openai_api_key
    assistantId   = var.openai_assistant_id
    vectorStoreId = var.openai_vector_store_id
  })
}

resource "aws_ssm_parameter" "brand_catalog" {
  name  = "/${local.name_prefix}/brands"
  type  = "String"
  value = jsonencode(var.brand_catalog)
}

resource "aws_ssm_parameter" "measurement_flag" {
  name  = "/${local.name_prefix}/disable_measurement_job"
  type  = "String"
  value = "false"
}

###############################
# Aurora y proxy
###############################

resource "aws_db_subnet_group" "aurora" {
  name       = "${local.name_prefix}-aurora"
  subnet_ids = [for s in aws_subnet.private_data : s.id]

  tags = merge(local.merged_tags, { Name = "${local.name_prefix}-aurora-subnets" })
}

resource "aws_rds_cluster" "aurora" {
  cluster_identifier                  = "${local.name_prefix}-aurora"
  engine                              = "aurora-postgresql"
  engine_version                      = var.aurora_engine_version
  database_name                       = "iadvisors"
  master_username                     = "iadvisors_admin"
  master_password                     = random_password.aurora.result
  db_subnet_group_name                = aws_db_subnet_group.aurora.name
  storage_encrypted                   = true
  backup_retention_period             = 7
  preferred_backup_window             = "06:00-07:00"
  preferred_maintenance_window        = "sun:07:00-sun:08:00"
  iam_database_authentication_enabled = true

  serverlessv2_scaling_configuration {
    min_capacity = var.aurora_min_capacity
    max_capacity = var.aurora_max_capacity
  }

  vpc_security_group_ids = [aws_security_group.aurora.id]

  tags = merge(local.merged_tags, { Component = "aurora" })
}

resource "aws_rds_cluster_instance" "aurora" {
  count              = 2
  identifier         = "${local.name_prefix}-aurora-${count.index}"
  cluster_identifier = aws_rds_cluster.aurora.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.aurora.engine
  engine_version     = aws_rds_cluster.aurora.engine_version
}

resource "aws_db_proxy" "aurora" {
  name                   = "${local.name_prefix}-proxy"
  engine_family          = "POSTGRESQL"
  idle_client_timeout    = 1800
  require_tls            = true
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_security_group_ids = [aws_security_group.aurora.id]
  vpc_subnet_ids         = [for s in aws_subnet.private_data : s.id]

  auth {
    description               = "aurora-secret"
    iam_auth                  = "DISABLED"
    secret_arn                = aws_secretsmanager_secret.aurora.arn
    client_password_auth_type = "POSTGRES_SCRAM_SHA_256"
  }

  lifecycle {
    ignore_changes = [auth]
  }
}

resource "aws_db_proxy_default_target_group" "aurora" {
  db_proxy_name = aws_db_proxy.aurora.name

  connection_pool_config {
    max_connections_percent      = 90
    max_idle_connections_percent = 50
    connection_borrow_timeout    = 120
  }
}

resource "aws_db_proxy_target" "aurora" {
  db_proxy_name         = aws_db_proxy.aurora.name
  target_group_name     = aws_db_proxy_default_target_group.aurora.name
  db_cluster_identifier = aws_rds_cluster.aurora.id
}

resource "aws_iam_role" "rds_proxy" {
  name = "${local.name_prefix}-rds-proxy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "rds.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "rds_proxy" {
  name = "${local.name_prefix}-rds-proxy-policy"
  role = aws_iam_role.rds_proxy.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = ["secretsmanager:GetSecretValue"],
        Resource = aws_secretsmanager_secret.aurora.arn
      }
    ]
  })
}

###############################
# Backup y exportaciones
###############################

resource "aws_backup_vault" "main" {
  name        = "${local.name_prefix}-vault"
  kms_key_arn = null

  tags = local.merged_tags
}

resource "aws_backup_plan" "main" {
  name = "${local.name_prefix}-plan"

  rule {
    rule_name         = "daily"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 5 * * ? *)"
    lifecycle {
      delete_after = 14
    }
  }
}

resource "aws_backup_selection" "aurora" {
  iam_role_arn = aws_iam_role.backup.arn
  name         = "aurora-selection"
  plan_id      = aws_backup_plan.main.id

  resources = [aws_rds_cluster.aurora.arn]
}

resource "aws_iam_role" "backup" {
  name = "${local.name_prefix}-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "backup.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

###############################
# ALB + ECS + Logs
###############################

resource "aws_lb" "app" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [for s in aws_subnet.public : s.id]
}

resource "aws_lb_target_group" "ecs" {
  name        = "${local.name_prefix}-tg"
  port        = 5001
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/health"
    matcher             = "200-399"
    interval            = 30
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = var.alb_certificate_arn == "" ? "forward" : "redirect"

    dynamic "forward" {
      for_each = var.alb_certificate_arn == "" ? [1] : []
      content {
        target_group {
          arn = aws_lb_target_group.ecs.arn
        }
      }
    }

    dynamic "redirect" {
      for_each = var.alb_certificate_arn == "" ? [] : [1]
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
}

resource "aws_lb_listener" "https" {
  count             = var.alb_certificate_arn == "" ? 0 : 1
  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.alb_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs.arn
  }
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/aws/ecs/${local.name_prefix}-api"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "measurements" {
  name              = "/aws/ecs/${local.name_prefix}-measurements"
  retention_in_days = 30
}

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"
}

resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "ecs-tasks.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "ecs-tasks.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_secrets" {
  name = "${local.name_prefix}-ecs-secrets"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "secretsmanager:GetSecretValue",
          "ssm:GetParameter",
          "ssm:GetParameters"
        ],
        Resource = [
          aws_secretsmanager_secret.openai.arn,
          aws_secretsmanager_secret.aurora.arn,
          aws_ssm_parameter.brand_catalog.arn,
          aws_ssm_parameter.measurement_flag.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${local.name_prefix}-ecs-execution-secrets"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "secretsmanager:GetSecretValue",
          "ssm:GetParameter",
          "ssm:GetParameters"
        ],
        Resource = [
          aws_secretsmanager_secret.openai.arn,
          aws_secretsmanager_secret.aurora.arn,
          aws_ssm_parameter.brand_catalog.arn,
          aws_ssm_parameter.measurement_flag.arn
        ]
      }
    ]
  })
}

resource "aws_ecr_repository" "backend" {
  name                 = "${local.name_prefix}-api"
  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }
}

locals {
  container_env = [
    {
      name  = "NODE_ENV"
      value = var.environment
    },
    {
      name  = "PORT"
      value = "5001"
    }
  ]

  # EventBridge scheduled tasks must run a one-off job and exit.
  # Using a Node inline script avoids requiring a separate job image.
  measurements_runner_js = <<-EOT
    const base = process.env.MEASUREMENT_TARGET_BASE_URL;
    if (!base) {
      throw new Error("MEASUREMENT_TARGET_BASE_URL is required");
    }

    (async () => {
      const brandsRes = await fetch(base + "/api/brands");
      if (!brandsRes.ok) {
        throw new Error("GET /api/brands " + brandsRes.status);
      }

      const payload = await brandsRes.json();
      const brands = (payload && payload.brands) || [];
      let failures = 0;

      for (const brand of brands) {
        if (!brand || !brand.id) continue;
        const res = await fetch(base + "/api/measurements/run", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-brand-id": brand.id
          },
          body: "{}"
        });
        if (!res.ok) {
          failures += 1;
          console.error("run failed", brand.id, res.status);
          continue;
        }
        console.log("run ok", brand.id);
      }

      if (failures) process.exit(1);
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  EOT
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${aws_ecr_repository.backend.repository_url}:latest"
      essential = true
      portMappings = [{
        containerPort = 5001,
        hostPort      = 5001,
        protocol      = "tcp"
      }]
      environment = local.container_env
      secrets = [
        {
          name      = "OPENAI_API_KEY"
          valueFrom = "${aws_secretsmanager_secret.openai.arn}:apiKey::"
        },
        {
          name      = "OPENAI_ASSISTANT_ID"
          valueFrom = "${aws_secretsmanager_secret.openai.arn}:assistantId::"
        },
        {
          name      = "OPENAI_VECTOR_STORE_ID"
          valueFrom = "${aws_secretsmanager_secret.openai.arn}:vectorStoreId::"
        },
        {
          name      = "DEFAULT_BRAND_ASSISTANT_ID"
          valueFrom = "${aws_secretsmanager_secret.openai.arn}:assistantId::"
        },
        {
          name      = "DEFAULT_BRAND_VECTOR_STORE_ID"
          valueFrom = "${aws_secretsmanager_secret.openai.arn}:vectorStoreId::"
        },
        {
          name      = "BRAND_CATALOG"
          valueFrom = aws_ssm_parameter.brand_catalog.arn
        },
        {
          name      = "DISABLE_MEASUREMENT_JOB"
          valueFrom = aws_ssm_parameter.measurement_flag.arn
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-region        = var.aws_region
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-stream-prefix = "api"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    assign_public_ip = false
    subnets          = [for s in aws_subnet.private_app : s.id]
    security_groups  = [aws_security_group.ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ecs.arn
    container_name   = "api"
    container_port   = 5001
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_lb_listener.http]
}

resource "aws_appautoscaling_target" "ecs" {
  max_capacity       = 4
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs_cpu" {
  name               = "${local.name_prefix}-cpu-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}

###############################
# WAF y Shield
###############################

resource "aws_wafv2_web_acl" "alb" {
  name        = "${local.name_prefix}-waf"
  description = "Basic protections for ALB"
  scope       = "REGIONAL"
  default_action {
    allow {}
  }

  rule {
    name     = "AWS-AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "commonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "RateLimit"
    priority = 2
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rateLimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "albWaf"
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.app.arn
  web_acl_arn  = aws_wafv2_web_acl.alb.arn
}

###############################
# EventBridge para mediciones
###############################

resource "aws_iam_role" "eventbridge_ecs" {
  name = "${local.name_prefix}-eventbridge-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "events.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "eventbridge_ecs" {
  name = "${local.name_prefix}-eventbridge-policy"
  role = aws_iam_role.eventbridge_ecs.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "ecs:RunTask",
          "ecs:StopTask",
          "iam:PassRole"
        ],
        Resource = "*"
      }
    ]
  })
}

resource "aws_cloudwatch_event_rule" "measurements" {
  name                = "${local.name_prefix}-measurements"
  description         = "Ejecuta el job de mediciones"
  schedule_expression = var.measurement_schedule_expression
}

resource "aws_cloudwatch_event_target" "measurements" {
  rule      = aws_cloudwatch_event_rule.measurements.name
  target_id = "ecs-scheduled-task"
  arn       = aws_ecs_cluster.main.arn
  role_arn  = aws_iam_role.eventbridge_ecs.arn
  input = jsonencode({
    containerOverrides = [
      {
        name        = "api"
        command     = ["node", "-e", local.measurements_runner_js]
        environment = [{ name = "MEASUREMENT_TARGET_BASE_URL", value = "http://${aws_lb.app.dns_name}" }]
      }
    ]
  })

  ecs_target {
    task_definition_arn = aws_ecs_task_definition.api.arn
    task_count          = 1
    launch_type         = "FARGATE"

    network_configuration {
      subnets          = [for s in aws_subnet.private_app : s.id]
      security_groups  = [aws_security_group.ecs.id]
      assign_public_ip = false
    }

    platform_version = "LATEST"
  }
}

###############################
# Observabilidad
###############################

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${local.name_prefix}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.app.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  alarm_name          = "${local.name_prefix}-ecs-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 75

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.api.name
  }
}

resource "aws_cloudwatch_metric_alarm" "aurora_capacity" {
  alarm_name          = "${local.name_prefix}-aurora-capacity"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ServerlessDatabaseCapacity"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.aurora_max_capacity - 0.5

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.aurora.id
  }
}

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-observability"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric",
        width  = 12,
        height = 6,
        properties = {
          metrics = [["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.app.arn_suffix]],
          stat    = "Sum",
          title   = "Requests ALB",
          region  = var.aws_region,
          period  = 60,
          view    = "timeSeries",
          stacked = false
        }
      },
      {
        type   = "metric",
        width  = 12,
        height = 6,
        properties = {
          metrics = [["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.api.name]],
          stat    = "Average",
          title   = "CPU ECS",
          region  = var.aws_region,
          period  = 60,
          view    = "timeSeries",
          stacked = false
        }
      },
      {
        type   = "metric",
        width  = 12,
        height = 6,
        properties = {
          metrics = [["AWS/RDS", "DatabaseConnections", "DBClusterIdentifier", aws_rds_cluster.aurora.id]],
          stat    = "Average",
          title   = "Conexiones Aurora",
          region  = var.aws_region,
          period  = 300,
          view    = "timeSeries",
          stacked = false
        }
      }
    ]
  })
}

###############################
# Salidas
###############################

output "frontend_bucket" {
  value       = aws_s3_bucket.frontend.bucket
  description = "Bucket donde publicar el build del frontend"
}

output "cloudfront_domain" {
  value       = aws_cloudfront_distribution.frontend.domain_name
  description = "Dominio asignado por CloudFront"
}

output "alb_dns_name" {
  value       = aws_lb.app.dns_name
  description = "URL pública del backend"
}

output "ecr_repository" {
  value       = aws_ecr_repository.backend.repository_url
  description = "Repositorio donde publicar la imagen del backend"
}

output "aurora_secret_arn" {
  value       = aws_secretsmanager_secret.aurora.arn
  description = "ARN del secreto con credenciales de Aurora"
}

output "openai_secret_arn" {
  value       = aws_secretsmanager_secret.openai.arn
  description = "ARN del secreto con credenciales OpenAI"
}

output "uploads_bucket" {
  value       = aws_s3_bucket.uploads.bucket
  description = "Bucket para adjuntos temporales"
}

output "measurement_rule_arn" {
  value       = aws_cloudwatch_event_rule.measurements.arn
  description = "ARN del EventBridge rule para mediciones"
}
