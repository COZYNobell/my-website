# terraform/main.tf

provider "aws" {
  region = "ap-northeast-2"
}

# ✨ 외부에서 GitHub Actions Runner의 IP를 받기 위한 변수 정의 ✨
variable "runner_ip" {
  description = "The public IP of the GitHub Actions runner for SSH access"
  type        = string
}

# --- 1. 네트워크 (VPC) ---
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.2"
  # ... (이전 VPC 설정과 동일)
}

# --- 2. EKS 클러스터 ---
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.8.4"
  # ... (이전 EKS 설정과 동일)
}

# ✨ EKS 워커 노드(EC2)를 위한 보안 그룹 (수정) ✨
resource "aws_security_group" "eks_nodes_sg" {
  name        = "my-eks-nodes-sg"
  description = "Security group for EKS worker nodes"
  vpc_id      = module.vpc.vpc_id

  # ✨ SSH 접속 규칙 소스를 'runner_ip' 변수로 지정 ✨
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["${var.runner_ip}/32"] # 이 워크플로우를 실행하는 Runner의 IP만 허용
    description = "Allow SSH from GitHub Actions Runner"
  }

  # ... (이하 다른 ingress 및 egress 규칙은 이전과 동일하게 유지)

  tags = {
    Name = "my-eks-nodes-sg"
  }
}
