output "rds_endpoint" {
  description = "RDS 엔드포인트 주소"
  value       = aws_db_instance.rds_instance.endpoint
}

output "db_name" {
  description = "RDS DB 이름"
  value       = aws_db_instance.rds_instance.db_name
}
