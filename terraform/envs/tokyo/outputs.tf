# 도쿄 RDS ARN 출력
output "rds_arn" {
  description = "ARN of the Tokyo Read Replica RDS instance"
  value       = module.rds.arn
}

# 도쿄 RDS 엔드포인트 출력
output "rds_endpoint" {
  description = "Endpoint of the Tokyo Read Replica RDS instance"
  value       = module.rds.endpoint
}

# VPC ID (참조용)
output "vpc_id" {
  value = module.network.vpc_id
}

# Public Subnet IDs (ALB용)
output "public_subnets" {
  value = module.network.public_subnets
}
