# ~/terraform/envs/seoul/outputs.tf

output "rds_endpoint" {
  description = "Primary RDS endpoint in Seoul"
  value       = module.rds.endpoint
}

output "rds_arn" {
  description = "ARN of the primary RDS instance in Seoul, used for Tokyo replica"
  value       = module.rds.arn
}

output "alb_dns_name" {
  description = "DNS name of the ALB in Seoul"
  value       = module.alb.alb_dns_name
}
