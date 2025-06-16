# terraform/main.tf

provider "aws" {
  region = var.aws_region
}

# --- 1. GitHub Actions 연동을 위한 IAM ---
# (이전과 동일: data "aws_iam_openid_connect_provider" 및 data "aws_iam_role")
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_role" "github_actions_role" {
  name = "GitHubActionsAdminRole"
}

# --- 2. 네트워크 (VPC) ---
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.2"
  name    = "my-eks-vpc"
  # ... (이하 VPC 설정은 이전과 동일하게 유지)
}

# --- 3. EKS 클러스터 (✨ 엔드포인트 설정 수정) ---
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.8.4"

  cluster_name    = var.cluster_name
  cluster_version = "1.29"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  # ✨ EKS API 서버 엔드포인트 설정 ✨
  # 퍼블릭 엔드포인트는 활성화하고,
  cluster_endpoint_public_access = true
  # 프라이빗 엔드포인트는 비활성화하여 외부 접속 문제를 원천적으로 방지합니다.
  cluster_endpoint_private_access = false

  eks_managed_node_groups = {
    default = {
      min_size     = 1
      max_size     = 3
      desired_size = 2
      instance_types = ["t3.medium"]
      key_name       = "Seoul-ec22-key"
    }
  }
}

# --- 4. 출력 값 ---
# (이전과 동일)
output "github_actions_role_arn" {
  description = "The ARN of the IAM role for GitHub Actions"
  value       = data.aws_iam_role.github_actions_role.arn
}


