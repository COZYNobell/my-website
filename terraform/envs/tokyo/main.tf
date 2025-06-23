# 1. 네트워크 모듈 호출
module "network" {
  source = "../../modules/network"

  vpc_cidr_block       = var.vpc_cidr_block
  public_subnet_cidrs  = ["10.1.1.0/24", "10.1.2.0/24"]
  private_subnet_cidrs = ["10.1.10.0/24", "10.1.11.0/24"]
  availability_zones   = ["ap-northeast-1a", "ap-northeast-1c"]
}

# 2. RDS 복제본 (서울 RDS의 Read Replica)
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

  # 서울의 RDS ARN을 기반으로 Read Replica 생성
  replicate_source_db = var.primary_rds_arn
}

# 3. ALB 모듈 호출
module "alb" {
  source          = "../../modules/alb"

  alb_name        = "web-alb-tokyo"
  vpc_id          = module.network.vpc_id
  subnets         = module.network.public_subnets
  security_groups = [module.network.alb_sg_id]
}

# 4. Autoscaling 모듈 호출
module "autoscaling" {
  source             = "../../modules/autoscaling"

  ami_id             = data.aws_ami.amazon_linux.id
  instance_type      = "t3.micro"
  security_group_ids = [module.network.rds_sg_id]
  vpc_subnets        = module.network.public_subnets
  target_group_arn   = module.alb.target_group_arn
  db_host            = module.rds.endpoint
}

# 5. Route53 레코드
module "route53" {
  source      = "../../modules/route53"

  zone_id     = var.route53_zone_id
  record_name = "tokyo.db.mydb.com"
  cname_value = module.rds.endpoint
}

# 최신 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}
