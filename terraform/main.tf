# 이 파일은 AWS 공급자 설정과 변수를 정의합니다.
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-2"
}

# --- 1. 네트워크 (VPC) 생성 ---
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.2"

  name = "my-eks-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["ap-northeast-2a", "ap-northeast-2b", "ap-northeast-2c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true

  public_subnet_tags = {
    "kubernetes.io/cluster/my-weather-app-cluster" = "shared"
    "kubernetes.io/role/elb"                      = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/my-weather-app-cluster" = "shared"
    "kubernetes.io/role/internal-elb"             = "1"
  }
}

# --- 2. EKS 클러스터 생성 ---
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.8.4"

  cluster_name    = "my-weather-app-cluster"
  cluster_version = "1.29"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    default = {
      min_size     = 1
      max_size     = 3
      desired_size = 2
      instance_types = ["t3.medium"]
      key_name      = "Seoul-ec22-key" # ✨ 워커 노드(EC2)에 접속할 키 페어 이름
    }
  }
}

# --- 3. RDS 데이터베이스 생성 ---
# RDS가 사용할 DB 서브넷 그룹 생성
resource "aws_db_subnet_group" "app_rds_subnet_group" {
  name       = "app-rds-subnet-group"
  subnet_ids = module.vpc.private_subnets # 프라이빗 서브넷에 배치
}

# RDS 보안 그룹 생성 (EKS 노드로부터의 접속만 허용)
resource "aws_security_group" "rds_sg" {
  name        = "app-rds-access-sg"
  description = "Allow EKS nodes to access RDS"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id] # EKS 노드 보안 그룹을 소스로 지정
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# 실제 RDS 인스턴스 생성
resource "aws_db_instance" "app_db" {
  identifier           = "weather-app-db"
  allocated_storage    = 20
  storage_type         = "gp2"
  engine               = "mysql"
  engine_version       = "8.0"
  instance_class       = "db.t3.micro"
  db_name              = "master_db"
  username             = "admin"
  password             = "mySuperSecurePassword123" # 실제로는 변수나 Secret Manager 사용
  db_subnet_group_name = aws_db_subnet_group.app_rds_subnet_group.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  skip_final_snapshot  = true
}

# --- 4. 출력 값 정의 ---
# 생성된 인프라의 중요한 정보들을 출력하여, GitHub Actions의 다음 단계에서 사용
output "rds_endpoint" {
  description = "The endpoint of the RDS instance"
  value       = aws_db_instance.app_db.endpoint
}

output "rds_db_name" {
  description = "The name of the database"
  value = aws_db_instance.app_db.db_name
}
