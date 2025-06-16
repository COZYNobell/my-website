terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  alias  = "seoul"
  region = "ap-northeast-2"
}

provider "aws" {
  alias  = "tokyo"
  region = "ap-northeast-1"
}

module "seoul" {
  source    = "./envs/seoul"
  providers = { aws = aws.seoul }

  db_name         = var.db_name_seoul
  db_user         = var.db_user
  db_password     = var.db_password
  route53_zone_id = var.route53_zone_id
}

module "tokyo" {
  source    = "./envs/tokyo"
  providers = { aws = aws.tokyo }

  db_name         = var.db_name_tokyo
  db_user         = var.db_user
  db_password     = var.db_password
  route53_zone_id = var.route53_zone_id
  primary_rds_arn = module.seoul.rds_arn
}
