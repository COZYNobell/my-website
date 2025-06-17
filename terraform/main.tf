# terraform/main.tf

# -----------------------------------------------------------------------------
# AWS 공급자 설정
# -----------------------------------------------------------------------------
provider "aws" {
  region = var.aws_region
}

# -----------------------------------------------------------------------------
# 1. GitHub Actions 연동을 위한 IAM (기존 리소스 조회)
# -----------------------------------------------------------------------------
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_role" "github_actions_role" {
  name = "GitHubActionsAdminRole"
}

# -----------------------------------------------------------------------------
# 2. 네트워크 (VPC) 생성
# -----------------------------------------------------------------------------
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

# -----------------------------------------------------------------------------
# 3. EKS 클러스터 생성
# -----------------------------------------------------------------------------
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.8.4"

  cluster_name    = var.cluster_name
  cluster_version = "1.29"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true

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

# -----------------------------------------------------------------------------
# 4. 출력 값 (Outputs)
# -----------------------------------------------------------------------------
output "github_actions_role_arn" {
  description = "The ARN of the IAM role for GitHub Actions"
  value       = data.aws_iam_role.github_actions_role.arn
}
