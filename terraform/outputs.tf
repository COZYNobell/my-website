output "seoul_rds_endpoint" {
  value = module.seoul.rds_endpoint
}

output "tokyo_rds_endpoint" {
  value = module.tokyo.rds_endpoint
}

output "global_alb_dns" {
  value = module.seoul.alb_dns_name
}
