variable "vpc_cidr_block" {
  description = "The CIDR block for the VPC (Tokyo region)"
  type        = string
}

variable "db_name" {
  description = "The name of the RDS database (replica will match)"
  type        = string
}

variable "db_user" {
  description = "The username for the RDS database (must match primary)"
  type        = string
}

variable "db_password" {
  description = "The password for the RDS database (must match primary)"
  type        = string
  sensitive   = true
}

variable "route53_zone_id" {
  description = "The hosted zone ID for Route53"
  type        = string
}

variable "primary_rds_arn" {
  description = "ARN of the primary RDS instance in Seoul"
  type        = string
}
