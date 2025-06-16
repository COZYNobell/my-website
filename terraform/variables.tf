variable "aws_region" {
  description = "AWS 리전을 지정합니다."
  type        = string
  default     = "ap-northeast-2"
}

variable "cluster_name" {
  description = "EKS 클러스터 이름입니다."
  type        = string
  default     = "weather-cluster"
}

variable "key_pair_name" {
  description = "EC2 SSH 키 페어 이름"
  type        = string
  default     = "Seoul-ec22-key"
}

variable "db_password" {
  description = "RDS 비밀번호"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "RDS 초기 DB 이름"
  type        = string
  default     = "weatherdb"
}
