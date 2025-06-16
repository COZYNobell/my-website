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

# GitHub Actions OIDC용 IAM 정보
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_role" "github_actions_role" {
  name = "GitHubActionsAdminRole"
}

# VPC (Seoul)
module "vpc_seoul" {
  source = "terraform-aws-modules/vpc/aws"
  version = "5.5.2"

  name = "seoul-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["ap-northeast-2a", "ap-northeast-2b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true
}

# EKS (Seoul)
module "eks_seoul" {
  source          = "terraform-aws-modules/eks/aws"
  version         = "20.8.4"
  cluster_name    = var.cluster_name
  cluster_version = "1.29"

  vpc_id     = module.vpc_seoul.vpc_id
  subnet_ids = module.vpc_seoul.private_subnets

  cluster_endpoint_public_access = true

  eks_managed_node_groups = {
    default = {
      min_size     = 1
      max_size     = 3
      desired_size = 2
      instance_types = ["t3.medium"]
      key_name       = var.key_pair_name
    }
  }
}

# RDS (Seoul) ← [11단계]
module "rds_seoul" {
  source            = "./modules/rds"
  name              = "seoul"
  db_username       = "admin"
  db_password       = var.db_password
  db_name           = var.db_name
  subnet_ids        = module.vpc_seoul.private_subnets
  security_group_id = module.eks_seoul.cluster_primary_security_group_id
}

# OUTPUTS
output "github_actions_role_arn" {
  description = "GitHub Actions용 IAM Role ARN"
  value       = data.aws_iam_role.github_actions_role.arn
}

output "seoul_rds_endpoint" {
  value = module.rds_seoul.endpoint
}

output "db_name" {
  value = var.db_name
}
