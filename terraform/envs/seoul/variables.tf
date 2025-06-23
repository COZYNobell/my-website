variable "region" {
  description = "AWS Region"
  type        = string
  default     = "ap-northeast-2"
}

variable "vpc_id" {
  description = "VPC ID for the EKS cluster"
  type        = string
  default     = "vpc-01dc2534a77a00126"
}

variable "public_subnet_ids" {
  description = "Public subnet IDs"
  type        = list(string)
  default     = ["subnet-xxxxxx1", "subnet-xxxxxx2"]  # 실제 ID로 수정
}

variable "private_subnet_ids" {
  description = "Private subnet IDs"
  type        = list(string)
  default     = ["subnet-yyyyyy1", "subnet-yyyyyy2"]  # 실제 ID로 수정
}
