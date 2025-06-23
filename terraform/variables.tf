variable "route53_zone_id" {
  description = "Route53 Hosted Zone ID"
  type        = string
}

variable "db_name_seoul" {
  description = "DB name for Seoul RDS"
  type        = string
}

variable "db_name_tokyo" {
  description = "DB name for Tokyo RDS"
  type        = string
}

variable "db_user" {
  description = "Database user"
  type        = string
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}
