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
  description = "EC2 노드 접속을 위한 SSH 키 페어 이름"
  type        = string
  default     = "Seoul-ec22-key.pem" # 본인이 만든 키 페어 이름으로 변경 가능
}
