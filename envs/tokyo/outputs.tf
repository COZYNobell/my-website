# ~/terraform/envs/tokyo/outputs.tf

output "rds_endpoint" {
  description = "RDS Replica endpoint in Tokyo"
  value       = module.rds_replica.endpoint
}

output "rds_arn" {
  description = "ARN of the RDS Replica in Tokyo"
  value       = module.rds_replica.arn
}

output "alb_dns_name" {
  description = "DNS name of the ALB in Tokyo"
  value       = module.alb.alb_dns_name
}
