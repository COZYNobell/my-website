# terraform/main.tf

provider "aws" {
  region = "ap-northeast-2"
}

# --- ✨ 1. GitHub Actions 연동을 위한 IAM OIDC 및 역할 생성 ✨ ---

# GitHub Actions를 신뢰하는 IAM OIDC 자격 증명 공급자 생성
# 이 리소스는 AWS 계정당 한 번만 생성하면 됩니다.
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com",
  ]

  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"] # GitHub OIDC의 공식 Thumbprint
}

# GitHub Actions 워크플로우가 수임할 IAM 역할 생성
resource "aws_iam_role" "github_actions_role" {
  name = "GitHubActionsAdminRole" # 역할 이름

  # 신뢰 정책: 특정 GitHub 저장소에서만 이 역할을 수임하도록 허용
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        },
        Action = "sts:AssumeRoleWithWebIdentity",
        Condition = {
          StringLike = {
            # "token.actions.githubusercontent.com:sub"은 토큰의 주체를 의미합니다.
            # "repo:조직/저장소이름:*" 형식으로 지정하여, 특정 저장소의 모든 브랜치/태그에서 실행되는 워크플로우를 신뢰합니다.
            "token.actions.githubusercontent.com:sub" = "repo:COZYNobell/my-website:*"
          }
        }
      }
    ]
  })
}

# 생성한 역할에 관리자 권한 정책 연결
# (주의: 실제 운영 환경에서는 EKS, ECR 등에 필요한 최소 권한만 부여하는 것이 안전합니다.)
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
