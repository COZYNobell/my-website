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
# 1. GitHub Actions 연동을 위한 IAM OIDC 및 역할 생성
# -----------------------------------------------------------------------------
# GitHub Actions를 신뢰하는 IAM OIDC 자격 증명 공급자 생성
# 이 리소스는 AWS 계정당 한 번만 생성하면 됩니다.
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com",
  ]

  # 이 지문은 GitHub의 공식 값이며, 변경될 수 있습니다.
  # 최신 값은 GitHub Docs에서 확인 가능합니다.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"] 
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
            # "repo:조직/저장소이름:*" 형식으로 지정하여, 특정 저장소의 모든 워크플로우를 신뢰합니다.
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:*"
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

  # IAM OIDC 공급자 활성화
  enable_irsa = true

  eks_managed_node_groups = {
    default = {
      min_size     = 1
      max_size     = 3
      desired_size = 2

      instance_types = ["t3.medium"]
      key_name      = "Seoul-ec22-key" # 워커 노드(EC2)에 접속할 키 페어 이름
    }
  }
}

# -----------------------------------------------------------------------------
# 4. 출력 값 (Outputs)
# -----------------------------------------------------------------------------
# 생성된 IAM 역할의 ARN을 출력하여, GitHub Actions 워크플로우가 참조할 수 있도록 합니다.
output "github_actions_role_arn" {
  description = "The ARN of the IAM role for GitHub Actions"
  value       = aws_iam_role.github_actions_role.arn
}

# kubectl이 클러스터에 접속할 수 있도록 설정 정보를 출력합니다. (워크플로우에서 직접 사용하지는 않음)
output "kubeconfig" {
  description = "Kubeconfig to connect to the EKS cluster"
  value       = module.eks.kubeconfig
  sensitive   = true
}
