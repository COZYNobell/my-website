# terraform/envs/seoul/main.tf

# 이 파일 내에서는 루트 main.tf에서 전달된
# 서울 리전용 프로바이더(alias = "seoul")를 사용하게 됩니다.

# 1. 네트워크 모듈 호출
module "network" {
  source = "../../modules/network"

  vpc_cidr_block       = var.vpc_cidr_block
  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnet_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]
  availability_zones   = ["ap-northeast-2a", "ap-northeast-2c"]
}

# 2. RDS 모듈 호출 (주 데이터베이스)
module "rds" {
  source             = "../../modules/rds"
  
  identifier         = "mydb-seoul-primary"
  instance_class     = "db.t3.micro"
  storage            = 20
  db_name            = var.db_name
  db_user            = var.db_user
  db_password        = var.db_password
  db_subnet_group    = module.network.private_subnet_group
  security_group_ids = [module.network.rds_sg_id]
  multi_az           = true # 서울은 Primary RDS이므로 Multi-AZ 활성화
}

# 3. ALB 모듈 호출
module "alb" {
  source          = "../../modules/alb"

  alb_name        = "web-alb-seoul"
  vpc_id          = module.network.vpc_id
  subnets         = module.network.public_subnets
  security_groups = [module.network.alb_sg_id]
}

# 4. Autoscaling 모듈 호출
module "autoscaling" {
  source             = "../../modules/autoscaling"

  ami_id             = data.aws_ami.amazon_linux.id
  instance_type      = "t3.micro"
  security_group_ids = [module.network.rds_sg_id] // EC2가 RDS에 접속할 수 있도록
  vpc_subnets        = module.network.public_subnets
  target_group_arn   = module.alb.target_group_arn
  db_host            = module.rds.endpoint
}

# 5. Route53 모듈 호출
module "route53" {
  source      = "../../modules/route53"

  zone_id     = var.route53_zone_id
  record_name = "seoul.db.mydb.com" // RDS CNAME 레코드
  cname_value = module.rds.endpoint
}

# EC2 인스턴스에서 사용할 최신 Amazon Linux 2 AMI를 조회하는 데이터 소스
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}
