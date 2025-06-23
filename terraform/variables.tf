variable "route53_zone_id" {
  type        = string
  description = "Route53 Hosted Zone ID"
}

variable "db_name_seoul" {
  type        = string
  description = "DB name for Seoul"
}

variable "db_name_tokyo" {
  type        = string
  description = "DB name for Tokyo"
}

variable "db_user" {
  type        = string
  description = "Database username"
}

variable "db_password" {
  type        = string
  description = "Database password"
  sensitive   = true
}
