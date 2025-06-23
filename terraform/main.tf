module "seoul" {
  source = "./envs/seoul"
  providers = {
    aws = aws.seoul
  }

  vpc_cidr_block   = "10.1.0.0/16"
  db_name          = var.db_name_seoul
  db_user          = var.db_user
  db_password      = var.db_password
  route53_zone_id  = var.route53_zone_id
}

module "tokyo" {
  source = "./envs/tokyo"
  providers = {
    aws = aws.tokyo
  }

  vpc_cidr_block   = "10.2.0.0/16"
  db_name          = var.db_name_tokyo
  db_user          = var.db_user
  db_password      = var.db_password
  route53_zone_id  = var.route53_zone_id
}
