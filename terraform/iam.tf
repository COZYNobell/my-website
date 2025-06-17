# terraform/iam.tf

# GitHub Actions를 신뢰하는 IAM OIDC 자격 증명 공급자 생성
# 이 리소스는 AWS 계정당 한 번만 성공적으로 생성되면 됩니다.
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com",
  ]

  # 이 지문은 GitHub의 공식 값입니다.
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
            # "repo:조직/저장소이름:*" 형식으로 지정합니다.
            "token.actions.githubusercontent.com:sub" = "repo:COZYNobell/my-website:*"
          }
        }
      }
    ]
  })
}

# 생성한 역할에 관리자 권한 정책 연결
# (주의: 실제 운영 환경에서는 필요한 최소 권한만 부여하는 것이 안전합니다.)
resource "aws_iam_role_policy_attachment" "admin_access" {
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
  role       = aws_iam_role.github_actions_role.name
}

# 생성된 역할의 ARN을 출력하여 GitHub Secret에 저장할 수 있도록 합니다.
output "github_actions_role_arn" {
  description = "The ARN of the IAM role for GitHub Actions"
  value       = aws_iam_role.github_actions_role.arn
}
