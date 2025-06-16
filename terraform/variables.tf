variable "db_name_seoul" {
  type        = string
  description = "Database name for Seoul"
}

variable "db_name_tokyo" {
  type        = string
  description = "Database name for Tokyo"
}

variable "db_user" {
  type        = string
  description = "Database username"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Database password"
}

variable "route53_zone_id" {
  type        = string
  description = "Route53 Hosted Zone ID"
}
