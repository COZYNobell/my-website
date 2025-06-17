# ~/terraform/envs/tokyo/variables.tf

variable "db_name" {
  type        = string
  description = "The name of the RDS database (passed from root: db_name_tokyo)"
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

variable "primary_rds_arn" {
  type        = string
  description = "ARN of the primary RDS in Seoul for CRRR replication (passed from root)"
}
