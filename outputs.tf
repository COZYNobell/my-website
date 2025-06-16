# ~/terraform/outputs.tf

output "seoul_rds_endpoint" {
  description = "The endpoint of the RDS instance in Seoul"
  value       = module.seoul.rds_endpoint
}

output "tokyo_rds_endpoint" {
  description = "The endpoint of the RDS instance in Tokyo"
  value       = module.tokyo.rds_endpoint
}

output "global_alb_dns" {
  description = "The DNS name of the primary ALB in Seoul"
  value       = module.seoul.alb_dns_name
}
