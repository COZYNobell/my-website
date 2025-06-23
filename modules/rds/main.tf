# ---------------------------------------------
# Subnet Group
# ---------------------------------------------
resource "aws_db_subnet_group" "default" {
  name       = "${var.identifier}-subnet-group"
  subnet_ids = split(",", var.db_subnet_group)  # 만약 string으로 받는다면
  tags = {
    Name = "${var.identifier}-subnet-group"
  }
}

# ---------------------------------------------
# 보안 그룹 리스트 압축
# ---------------------------------------------
locals {
  sg_ids = var.security_group_ids
}

# ---------------------------------------------
# 일반 RDS 인스턴스 생성 (서울)
# ---------------------------------------------
resource "aws_db_instance" "main" {
  count                   = var.replicate_source_db == null ? 1 : 0
  identifier              = var.identifier
  instance_class          = var.instance_class
  allocated_storage       = var.storage
  engine                  = "mysql"
  engine_version          = "8.0"
  username                = var.db_user
  password                = var.db_password
  db_name                 = var.db_name
  multi_az                = var.multi_az
  publicly_accessible     = false
  vpc_security_group_ids  = local.sg_ids
  db_subnet_group_name    = aws_db_subnet_group.default.name
  skip_final_snapshot     = true

  tags = {
    Name = var.identifier
  }
}

# ---------------------------------------------
# Read Replica 생성 (도쿄)
# ---------------------------------------------
resource "aws_db_instance" "replica" {
  count                    = var.replicate_source_db != null ? 1 : 0
  identifier               = var.identifier
  instance_class           = var.instance_class
  replicate_source_db      = var.replicate_source_db
  publicly_accessible      = false
  vpc_security_group_ids   = local.sg_ids
  db_subnet_group_name     = aws_db_subnet_group.default.name
  skip_final_snapshot      = true

  tags = {
    Name = "${var.identifier}-replica"
  }
}
