# RDS ARN (도쿄 리전에서 참조)
output "rds_arn" {
  description = "ARN of the primary RDS instance (for replica)"
  value       = module.rds.arn
}

# RDS Endpoint (예: Route53 등록용 등)
output "rds_endpoint" {
  description = "Primary RDS endpoint"
  value       = module.rds.endpoint
}

# VPC ID (필요 시 외부 참조 가능)
output "vpc_id" {
  value = module.network.vpc_id
}

# Public Subnet IDs (예: ALB 등에서 사용 가능)
output "public_subnets" {
  value = module.network.public_subnets
}

# Private Subnet IDs
output "private_subnets" {
  value = module.network.private_subnets
}
