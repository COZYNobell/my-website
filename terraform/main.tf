# terraform/main.tf

provider "aws" {
  region = "ap-northeast-2"
}

# --- 1. GitHub Actions 연동을 위한 IAM OIDC 및 역할 생성 ---

# ✨ 이미 존재하는 GitHub OIDC 공급자 정보를 'data' 소스로 가져옵니다. ✨
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

# GitHub Actions 워크플로우가 수임할 IAM 역할 생성
resource "aws_iam_role" "github_actions_role" {
  name = "GitHubActionsAdminRole"

  # 신뢰 정책: data 소스로 가져온 OIDC 공급자의 ARN을 사용합니다.
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Federated = data.aws_iam_openid_connect_provider.github.arn
        },
        Action = "sts:AssumeRoleWithWebIdentity",
        Condition = {
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:COZYNobell/my-website:*"
          }
        }
      }
    ]
  })
}

# 생성한 역할에 관리자 권한 정책 연결
resource "aws_iam_role_policy_attachment" "admin_access" {
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
  role       = aws_iam_role.github_actions_role.name
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
  value       = aws_iam_role.github_actions_role.arn
}

output "kubeconfig" {
  description = "Kubeconfig to connect to the EKS cluster"
  value       = module.eks.kubeconfig
  sensitive   = true
}
