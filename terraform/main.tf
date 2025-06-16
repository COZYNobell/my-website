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

# ... (이하 VPC, EKS, RDS 모듈 정의는 이전과 동일하게 유지)
