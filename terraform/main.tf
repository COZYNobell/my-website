# terraform/main.tf

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

# --- 1. GitHub Actions 연동을 위한 IAM ---
# 이미 존재하는 GitHub OIDC 공급자 정보 조회
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# 이미 존재하는 GitHub Actions 역할 정보 조회
data "aws_iam_role" "github_actions_role" {
  name = "GitHubActionsAdminRole"
}

# --- 2. 네트워크 (VPC) ---
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.2"

  name = "my-eks-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true

  public_subnet_tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/elb"                      = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/internal-elb"             = "1"
  }
}

# --- 3. EKS 클러스터 ---
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.8.4"

  cluster_name    = var.cluster_name
  cluster_version = "1.29"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # ✨ EKS가 생성하는 기본 보안 그룹에 추가적인 규칙을 설정합니다.
  cluster_endpoint_public_access       = true
  cluster_endpoint_public_access_cidrs = ["0.0.0.0/0"] # 모든 곳에서 EKS API 접속 허용

  eks_managed_node_groups = {
    default = {
      min_size     = 1
      max_size     = 3
      desired_size = 2
      instance_types = ["t3.medium"]
      key_name       = "Seoul-ec22-key" # ✨ 워커 노드(EC2)에 접속할 키 페어 이름
    }
  }
}

# --- 4. RDS 데이터베이스 ---
# (이 부분은 필요에 따라 나중에 추가할 수 있습니다. 지금은 EKS 접속 문제 해결에 집중합니다.)
# resource "aws_db_instance" "app_db" { ... }
