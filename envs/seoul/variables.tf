# ~/terraform/envs/seoul/variables.tf

variable "db_name" {
  type        = string
  description = "The name of the RDS database (passed from root: db_name_seoul)"
}

variable "db_user" {
  type        = string
  description = "The username for the RDS database (passed from root)"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "The password for the RDS database (passed from root)"
}

variable "route53_zone_id" {
  type        = string
  description = "The hosted zone ID for Route53 (passed from root)"
}
