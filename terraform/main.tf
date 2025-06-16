# terraform/main.tf

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "2.12.1"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "2.23.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-2"
}

# EKS 클러스터와 통신하기 위한 설정
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
}

# Helm 차트 배포를 위한 설정
provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
      command     = "aws"
    }
  }
}

# --- 1. GitHub Actions 연동을 위한 IAM OIDC 및 역할 ---
data "aws_iam_policy_document" "github_actions_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }
    
    # (선택적 보안 강화) 특정 GitHub 저장소 및 브랜치만 허용
    # condition {
    #   test     = "StringEquals"
    #   variable = "${module.eks.oidc_provider}:sub"
    #   values   = ["repo:COZYNobell/my-website:ref:refs/heads/main"]
    # }
  }
}

resource "aws_iam_role" "github_actions_role" {
  name               = "GitHubActionsAdminRoleForEKS"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume_role.json
}

resource "aws_iam_role_policy_attachment" "admin_access" {
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
  role       = aws_iam_role.github_actions_role.name
}

# --- 2. 네트워크 (VPC) ---
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.2"
  # ... (이전 VPC 설정과 동일)
}

# --- 3. EKS 클러스터 ---
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.8.4"
  # ... (이전 EKS 설정과 동일)
  
  # IAM OIDC 공급자 활성화
  enable_irsa = true
}

# --- 4. RDS 데이터베이스 ---
# ... (이전 RDS 리소스 정의와 동일)
