# terraform/variables.tf

variable "aws_region" {
  description = "The AWS region to deploy resources in."
  type        = string
  default     = "ap-northeast-2"
}

variable "db_name_seoul" {
  description = "The DB name for the Seoul RDS database"
  type        = string
}

variable "db_name_tokyo" {
  description = "The DB name for the Tokyo RDS database"
  type        = string
}

variable "db_password" {
  description = "The password for the RDS database"
  type        = string
  sensitive   = true # 이 값은 Terraform 로그에 표시되지 않습니다.
}

variable "route53_zone_id" {
  description = "The hosted zone ID for Route53"
  type        = string
}
