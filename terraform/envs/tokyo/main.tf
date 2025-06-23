# terraform/envs/tokyo/main.tf

# 이 파일 내에서는 루트 main.tf에서 전달된
# 도쿄 리전용 프로바이더(alias = "tokyo")를 사용하게 됩니다.

# 1. 네트워크 모듈 호출
module "network" {
  source = "../../modules/network"

  vpc_cidr_block       = var.vpc_cidr_block
  public_subnet_cidrs  = ["10.2.1.0/24", "10.2.2.0/24"]
  private_subnet_cidrs = ["10.2.10.0/24", "10.2.11.0/24"]
  availability_zones   = ["ap-northeast-1a", "ap-northeast-1c"]
}

# 2. RDS 모듈 호출 (서울 RDS의 읽기 전용 복제본)
module "rds_replica" {
  source               = "../../modules/rds"
  
  identifier           = "mydb-tokyo-replica"
  replicate_source_arn = var.primary_rds_arn  # 루트에서 전달받은 서울 RDS ARN
  instance_class       = "db.t3.micro"
  storage              = 20
  db_subnet_group      = module.network.private_subnet_group
  security_group_ids   = [module.network.rds_sg_id]
  multi_az             = false # 읽기 전용 복제본은 다중 AZ를 지원하지 않음

  # 복제본 생성 시 아래 값들은 실제로는 사용되지 않으나, 모듈 변수 정의상 필요합니다.
  db_user     = var.db_user
  db_password = var.db_password
  db_name     = var.db_name
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
  db_host            = module.rds_replica.endpoint # 도쿄 RDS Replica 엔드포인트 사용
  vpc_subnets        = module.network.public_subnets
  target_group_arn   = module.alb.target_group_arn
}

# 5. Route53 모듈 호출
module "route53_failover" {
  source      = "../../modules/route53"

  zone_id     = var.route53_zone_id
  record_name = "tokyo.db.mydb.com"
  cname_value = module.rds_replica.endpoint
}

# 도쿄 리전의 EC2 인스턴스에서 사용할 최신 Amazon Linux 2 AMI를 조회
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}
