# ~/terraform/variables.tf

variable "db_name_seoul" {
  type        = string
  description = "The DBname for the Seoul RDS database"
}

variable "db_name_tokyo" {
  type        = string
  description = "The DBname for the Tokyo RDS database"
}

variable "db_user" {
  type        = string
  description = "The username for the RDS database"
}

variable "db_password" {
  type        = string
  description = "The password for the RDS database"
  sensitive   = true
}

variable "route53_zone_id" {
  type        = string
  description = "The hosted zone ID for Route53"
}
