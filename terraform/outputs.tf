output "github_actions_role_arn" {
  description = "GitHub Actions가 사용하는 IAM Role의 ARN"
  value       = data.aws_iam_role.github_actions_role.arn
}

output "db_name" {
  description = "RDS에서 사용할 DB 이름 (기본값)"
  value       = "weather"
}

output "seoul_rds_endpoint" {
  description = "서울 RDS 인스턴스의 엔드포인트"
  value       = module.seoul.rds_endpoint
}

output "tokyo_rds_endpoint" {
  description = "도쿄 RDS 복제본의 엔드포인트"
  value       = module.tokyo.rds_endpoint
}
