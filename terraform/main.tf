provider "aws" {
  alias  = "seoul"
  region = "ap-northeast-2"
}

provider "aws" {
  alias  = "tokyo"
  region = "ap-northeast-1"
}

module "seoul" {
  source = "../envs/seoul"  # 또는 ./envs/seoul (상대 경로 확인 필요)
  providers = { aws = aws.seoul }

  vpc_cidr_block   = "10.1.0.0/16"
  db_name          = var.db_name_seoul
  db_user          = var.db_user
  db_password      = var.db_password
  route53_zone_id  = var.route53_zone_id
}

module "tokyo" {
  source = "../envs/tokyo"
  providers = { aws = aws.tokyo }

  vpc_cidr_block   = "10.2.0.0/16"
  db_name          = var.db_name_tokyo
  db_user          = var.db_user
  db_password      = var.db_password
  route53_zone_id  = var.route53_zone_id
}
