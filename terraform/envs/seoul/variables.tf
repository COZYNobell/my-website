# terraform/envs/seoul/variables.tf

variable "vpc_cidr_block" {
  description = "The CIDR block for the VPC (passed from root)"
  type        = string
}

variable "db_name" {
  description = "The name of the RDS database (passed from root: db_name_seoul)"
  type        = string
}

variable "db_user" {
  description = "The username for the RDS database (passed from root)"
  type        = string
}

variable "db_password" {
  description = "The password for the RDS database (passed from root)"
  type        = string
  sensitive   = true
}

variable "route53_zone_id" {
  description = "The hosted zone ID for Route53 (passed from root)"
  type        = string
}
