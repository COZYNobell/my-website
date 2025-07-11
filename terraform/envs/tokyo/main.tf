# ------------------------------------------
# 서울 리전의 기존 RDS 정보 참조 (data source)
# ------------------------------------------
data "aws_db_instance" "seoul_primary" {
  provider = aws.seoul
  db_instance_identifier = "seoul-free-db"
}

# ------------------------------------------
# 네트워크 모듈 호출 (도쿄)
# ------------------------------------------
module "network" {
  source = "../../modules/network"

  vpc_cidr_block       = var.vpc_cidr_block
  public_subnet_cidrs  = ["10.1.1.0/24", "10.1.2.0/24"]
  private_subnet_cidrs = ["10.1.10.0/24", "10.1.11.0/24"]
  availability_zones   = ["ap-northeast-1a", "ap-northeast-1c"]
}

# ------------------------------------------
# RDS 복제본 (도쿄 리전)
# ------------------------------------------
module "rds" {
  source             = "../../modules/rds"

  identifier         = "mydb-tokyo-replica"
  instance_class     = "db.t3.micro"
  storage            = 20
  db_name            = var.db_name
  db_user            = var.db_user
  db_password        = var.db_password
  db_subnet_group    = module.network.private_subnet_group
  security_group_ids = [module.network.rds_sg_id]
  multi_az           = false

  # ✅ 서울 RDS에서 가져온 ARN을 복제 원본으로 지정
  replicate_source_db = data.aws_db_instance.seoul_primary.arn
}

# ------------------------------------------
# ALB 모듈 호출
# ------------------------------------------
module "alb" {
  source          = "../../modules/alb"

  alb_name        = "web-alb-tokyo"
  vpc_id          = module.network.vpc_id
  subnets         = module.network.public_subnets
  security_groups = [module.network.alb_sg_id]
}

# ------------------------------------------
# EC2 오토스케일링 모듈
# ------------------------------------------
module "autoscaling" {
  source             = "../../modules/autoscaling"

  ami_id             = data.aws_ami.amazon_linux.id
  instance_type      = "t3.micro"
  security_group_ids = [module.network.rds_sg_id]
  vpc_subnets        = module.network.public_subnets
  target_group_arn   = module.alb.target_group_arn
  db_host            = module.rds.endpoint
}

# ------------------------------------------
# Route53 레코드 등록 (도쿄용 CNAME)
# ------------------------------------------
module "route53" {
  source      = "../../modules/route53"

  zone_id     = var.route53_zone_id
  record_name = "tokyo.db.mydb.com"
  cname_value = module.rds.endpoint
}

# ------------------------------------------
# 최신 Amazon Linux 2 AMI 조회
# ------------------------------------------
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}
