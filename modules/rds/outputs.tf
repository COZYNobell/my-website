# 출력: RDS 인스턴스 ARN (서울 or 도쿄)
output "arn" {
  description = "ARN of the RDS instance (primary or replica)"
  value = (
    length(aws_db_instance.main) > 0 ?
    aws_db_instance.main[0].arn :
    aws_db_instance.replica[0].arn
  )
}

# 출력: RDS 인스턴스 엔드포인트
output "endpoint" {
  description = "Endpoint of the RDS instance"
  value = (
    length(aws_db_instance.main) > 0 ?
    aws_db_instance.main[0].endpoint :
    aws_db_instance.replica[0].endpoint
  )
}
