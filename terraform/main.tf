# terraform/main.tf

provider "aws" {
  region = "ap-northeast-2"
}

# --- 1. GitHub Actions 연동을 위한 IAM ---

# 이미 존재하는 GitHub OIDC 공급자 정보 조회
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# 수동으로 생성한 IAM 역할 정보 조회
data "aws_iam_role" "github_actions_role" {
  name = "GitHubActionsAdminRole"
}


# --- 2. 네트워크 (VPC) ---
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

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

# --- 3. EKS 클러스터 (✨ 충돌 방지 설정 추가) ---
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.8.4"

  cluster_name    = "my-weather-app-cluster"
  cluster_version = "1.29"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # ✨ KMS 키와 CloudWatch 로그 그룹을 Terraform이 새로 만들지 않도록 설정합니다.
  #    EKS는 기본값을 사용하거나, 이미 존재하는 리소스를 재사용하게 됩니다.
  create_cloudwatch_log_group = false
  cluster_encryption_config = {}

  eks_managed_node_groups = {
    standard_workers = {
      min_size     = 1
      max_size     = 3
      desired_size = 2

      instance_type = "t3.medium"
      key_name      = "Seoul-ec22-key.pem"
    }
  }
}

# --- 4. 출력 값 ---
output "github_actions_role_arn" {
  description = "The ARN of the IAM role for GitHub Actions"
  value       = data.aws_iam_role.github_actions_role.arn
}
