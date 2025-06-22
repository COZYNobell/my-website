# terraform/main.tf

# -----------------------------------------------------------------------------
# AWS 공급자 및 Terraform 버전 설정
# -----------------------------------------------------------------------------
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# -----------------------------------------------------------------------------
# 데이터 소스 (기존 리소스 정보 조회)
# -----------------------------------------------------------------------------

# 1. 기존 VPC 정보 조회
data "aws_vpc" "existing" {
  id = "vpc-01dc2534a77a00126"
}

# 2. 기존 Private Subnet 정보 조회
data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.existing.id]
  }
  # 제공해주신 Private Subnet ID 목록
  ids = ["subnet-0adaea0f3d503a438", "subnet-014c112f289df7e41"]
}

# 3. 기존 Public Subnet 정보 조회
data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.existing.id]
  }
  # 제공해주신 Public Subnet ID 목록
  ids = ["subnet-03369a6e7ce789929", "subnet-0907d17d229b2213c"]
}

# 4. 기존 RDS 정보 조회
data "aws_db_instance" "existing_rds" {
  db_instance_identifier = "seoul-free-db"
}

# -----------------------------------------------------------------------------
# EKS 클러스터 및 Bastion Host 생성
# -----------------------------------------------------------------------------

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.8.4"

  cluster_name    = var.cluster_name
  cluster_version = "1.29"

  vpc_id                          = data.aws_vpc.existing.id
  subnet_ids                      = data.aws_subnets.private.ids
  cluster_endpoint_public_access  = true

  eks_managed_node_group_defaults = {
    # 워커 노드에 app-server-sg 보안 그룹을 연결합니다.
    vpc_security_group_ids = [var.app_server_sg_id]
  }

  eks_managed_node_groups = {
    default_nodes = {
      min_size     = 1
      max_size     = 3
      desired_size = 2
      instance_types = ["t3.medium"]
      key_name = "Seoul-ec22-key"
    }
  }
}

resource "aws_instance" "bastion" {
  ami           = "ami-0c9c942bd7bf113a2" # Amazon Linux 2023 AMI (서울 리전 기준)
  instance_type = "t2.micro"
  
  # 퍼블릭 서브넷 중 첫 번째 서브넷에 배치합니다.
  subnet_id = data.aws_subnets.public.ids[0]
  
  # Bastion Host에 monitoring-sg 보안 그룹을 적용합니다.
  vpc_security_group_ids = [var.monitoring_sg_id]
  
  key_name = "Seoul-ec22-key"

  tags = {
    Name = "Bastion-Host-for-Alpha-v2"
  }
}

# -----------------------------------------------------------------------------
# 출력 값 (Outputs)
# -----------------------------------------------------------------------------
output "bastion_public_ip" {
  description = "The public IP address of the Bastion Host"
  value       = aws_instance.bastion.public_ip
}

output "rds_endpoint" {
  description = "The endpoint of the existing RDS instance"
  value       = data.aws_db_instance.existing_rds.endpoint
}

output "eks_cluster_endpoint" {
  description = "EKS Cluster API endpoint"
  value       = module.eks.cluster_endpoint
}

