# terraform/main.tf

provider "aws" {
  region = "ap-northeast-2"
}

# --- 1. GitHub Actions 연동을 위한 IAM ---

# 이미 존재하는 GitHub OIDC 공급자 정보를 'data' 소스로 가져옵니다.
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# 수동으로 생성한 IAM 역할을 이름으로 조회합니다.
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

# --- 3. EKS 클러스터 ---
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.0.0"

  cluster_name    = "my-weather-app-cluster"
  cluster_version = "1.28"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    standard_workers = {
      min_size     = 1
      max_size     = 3
      desired_size = 2

      instance_type = "t3.medium"
      key_name      = "Seoul-ec22-key"
    }
  }
}

# --- 4. 출력 값 ---
output "github_actions_role_arn" {
  description = "The ARN of the IAM role for GitHub Actions"
  value       = data.aws_iam_role.github_actions_role.arn
}

# ✨ 오류를 발생시키는 kubeconfig 출력 블록을 제거했습니다. ✨
# 이 정보는 워크플로우의 'aws eks update-kubeconfig' 스텝을 통해 자동으로 처리됩니다.
