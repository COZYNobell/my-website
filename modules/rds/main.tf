# ~/terraform/modules/rds/main.tf

resource "aws_db_instance" "this" {
  identifier           = var.identifier
  engine               = "mysql"
  engine_version       = "8.0"
  instance_class       = var.instance_class
  allocated_storage    = var.storage

  # replicate_source_arn이 null일 때 (즉, Primary DB일 때)만 이 값들을 설정합니다.
  db_name              = var.replicate_source_arn == null ? var.db_name : null
  username             = var.replicate_source_arn == null ? var.db_user : null
  password             = var.replicate_source_arn == null ? var.db_password : null
  
  skip_final_snapshot  = true # 테스트 환경에서는 true, 운영에서는 false 권장
  db_subnet_group_name = var.db_subnet_group
  vpc_security_group_ids = var.security_group_ids

  # CRRR(Cross-Region Read Replica)인 경우에만 source ARN을 지정합니다.
  replicate_source_db  = var.replicate_source_arn != null ? var.replicate_source_arn : null

  # 서울(Primary)은 다중 AZ, 도쿄(Replica)는 단일 AZ로 설정합니다 (CRRR는 다중AZ 미지원).
  multi_az             = var.multi_az

  # 원본 RDS 인스턴스(서울)에만 자동 백업 설정
  backup_retention_period = var.replicate_source_arn == null ? 7 : 0

  # lifecycle 블록은 Promote 이후 상태 변경 시 Terraform 충돌을 방지합니다.
  lifecycle {
    ignore_changes = [
      replicate_source_db,
    ]
  }

  tags = {
    Name = var.identifier
  }
}
